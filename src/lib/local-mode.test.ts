import assert from "node:assert/strict";
import test from "node:test";
import { isLocalMode } from "./local-mode";

function withEnv(vars: Record<string, string | undefined>, run: () => void) {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const localish = {
  FITLOG_LOCAL: "1",
  VERCEL: undefined,
  VERCEL_ENV: undefined,
  NODE_ENV: "development",
};

test("engages only with the explicit opt-in flag", () => {
  withEnv(localish, () => assert.equal(isLocalMode(), true));
  withEnv({ ...localish, FITLOG_LOCAL: undefined }, () =>
    assert.equal(isLocalMode(), false)
  );
  withEnv({ ...localish, FITLOG_LOCAL: "0" }, () =>
    assert.equal(isLocalMode(), false)
  );
});

test("never engages on a Vercel deployment, even with the flag", () => {
  withEnv({ ...localish, VERCEL: "1" }, () => assert.equal(isLocalMode(), false));
  withEnv({ ...localish, VERCEL_ENV: "preview" }, () =>
    assert.equal(isLocalMode(), false)
  );
  withEnv({ ...localish, VERCEL_ENV: "production" }, () =>
    assert.equal(isLocalMode(), false)
  );
});

test("never engages in a production build, even with the flag", () => {
  withEnv({ ...localish, NODE_ENV: "production" }, () =>
    assert.equal(isLocalMode(), false)
  );
});
