import { afterEach, expect, test, vi } from "vitest";
import {
  getRecoveryMarkerSecret,
  RECOVERY_MARKER_MAX_AGE_MS,
  signRecoveryMarker,
  verifyRecoveryMarker,
} from "./recovery-marker";

afterEach(() => {
  vi.unstubAllEnvs();
});

const SECRET = "test-recovery-marker-secret-0123456789";
const SUB = "11111111-2222-3333-4444-555555555555";
const NOW = 1_788_000_000_000;

test("a freshly signed marker verifies for the same subject and secret", async () => {
  const marker = await signRecoveryMarker(SUB, NOW, SECRET);
  expect(
    await verifyRecoveryMarker(marker, {
      sub: SUB,
      nowMs: NOW,
      secret: SECRET,
    }),
  ).toBe(true);
});

test("a marker verifies at exactly the max age boundary", async () => {
  const marker = await signRecoveryMarker(SUB, NOW, SECRET);
  expect(
    await verifyRecoveryMarker(marker, {
      sub: SUB,
      nowMs: NOW + RECOVERY_MARKER_MAX_AGE_MS,
      secret: SECRET,
    }),
  ).toBe(true);
});

test("a marker one millisecond past the max age is rejected", async () => {
  const marker = await signRecoveryMarker(SUB, NOW, SECRET);
  expect(
    await verifyRecoveryMarker(marker, {
      sub: SUB,
      nowMs: NOW + RECOVERY_MARKER_MAX_AGE_MS + 1,
      secret: SECRET,
    }),
  ).toBe(false);
});

test("a marker signed with a different secret is rejected", async () => {
  const marker = await signRecoveryMarker(SUB, NOW, SECRET);
  expect(
    await verifyRecoveryMarker(marker, {
      sub: SUB,
      nowMs: NOW,
      secret: "a-different-secret",
    }),
  ).toBe(false);
});

test("a marker is rejected when the current subject does not match the signed subject", async () => {
  const marker = await signRecoveryMarker(SUB, NOW, SECRET);
  expect(
    await verifyRecoveryMarker(marker, {
      sub: "99999999-8888-7777-6666-555555555555",
      nowMs: NOW,
      secret: SECRET,
    }),
  ).toBe(false);
});

test("a marker with a tampered signature segment is rejected", async () => {
  const marker = await signRecoveryMarker(SUB, NOW, SECRET);
  const [sub, issuedAt, mac] = marker.split(".");
  const flipped = mac[0] === "A" ? `B${mac.slice(1)}` : `A${mac.slice(1)}`;
  expect(
    await verifyRecoveryMarker(`${sub}.${issuedAt}.${flipped}`, {
      sub: SUB,
      nowMs: NOW,
      secret: SECRET,
    }),
  ).toBe(false);
});

test("a marker with a tampered issued-at segment is rejected", async () => {
  const marker = await signRecoveryMarker(SUB, NOW, SECRET);
  const [sub, , mac] = marker.split(".");
  expect(
    await verifyRecoveryMarker(`${sub}.${NOW + 1}.${mac}`, {
      sub: SUB,
      nowMs: NOW,
      secret: SECRET,
    }),
  ).toBe(false);
});

test("a null, undefined, or empty marker is rejected", async () => {
  const opts = { sub: SUB, nowMs: NOW, secret: SECRET };
  expect(await verifyRecoveryMarker(null, opts)).toBe(false);
  expect(await verifyRecoveryMarker(undefined, opts)).toBe(false);
  expect(await verifyRecoveryMarker("", opts)).toBe(false);
});

test("a marker without exactly three segments is rejected", async () => {
  const opts = { sub: SUB, nowMs: NOW, secret: SECRET };
  expect(await verifyRecoveryMarker(`${SUB}.${NOW}`, opts)).toBe(false);
  expect(await verifyRecoveryMarker(`${SUB}.${NOW}.mac.extra`, opts)).toBe(
    false,
  );
});

test("a marker with a non-numeric issued-at is rejected", async () => {
  const marker = await signRecoveryMarker(SUB, NOW, SECRET);
  const [sub, , mac] = marker.split(".");
  expect(
    await verifyRecoveryMarker(`${sub}.not-a-number.${mac}`, {
      sub: SUB,
      nowMs: NOW,
      secret: SECRET,
    }),
  ).toBe(false);
});

test("a marker whose signature segment is not valid base64url is rejected", async () => {
  expect(
    await verifyRecoveryMarker(`${SUB}.${NOW}.not valid base64!`, {
      sub: SUB,
      nowMs: NOW,
      secret: SECRET,
    }),
  ).toBe(false);
});

test("verification is rejected when no secret is configured", async () => {
  const marker = await signRecoveryMarker(SUB, NOW, SECRET);
  expect(
    await verifyRecoveryMarker(marker, { sub: SUB, nowMs: NOW, secret: "" }),
  ).toBe(false);
});

test("an explicit maxAgeMs override is honoured", async () => {
  const marker = await signRecoveryMarker(SUB, NOW, SECRET);
  expect(
    await verifyRecoveryMarker(marker, {
      sub: SUB,
      nowMs: NOW + 5_000,
      secret: SECRET,
      maxAgeMs: 1_000,
    }),
  ).toBe(false);
  expect(
    await verifyRecoveryMarker(marker, {
      sub: SUB,
      nowMs: NOW + 5_000,
      secret: SECRET,
      maxAgeMs: 10_000,
    }),
  ).toBe(true);
});

test("getRecoveryMarkerSecret returns the configured value when set", () => {
  vi.stubEnv("RECOVERY_MARKER_SECRET", "from-the-environment");
  expect(getRecoveryMarkerSecret()).toBe("from-the-environment");
});

test("getRecoveryMarkerSecret falls back to a fixed dev value outside production", () => {
  vi.stubEnv("RECOVERY_MARKER_SECRET", "");
  vi.stubEnv("NODE_ENV", "development");
  expect(getRecoveryMarkerSecret()).toBe(
    "insecure-development-only-recovery-marker-secret",
  );
});

test("getRecoveryMarkerSecret returns an empty string in production when unset", () => {
  vi.stubEnv("RECOVERY_MARKER_SECRET", "");
  vi.stubEnv("NODE_ENV", "production");
  expect(getRecoveryMarkerSecret()).toBe("");
});
