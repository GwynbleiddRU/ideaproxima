import { expect, test } from "@playwright/test";
import { IDEA, signIn, watchErrors } from "./helpers";

test("a failed stance shows the server request ID in the error toast", async ({ page }) => {
  await signIn(page);
  await page.route("**/v1/ideas/*/stances/*", (route) =>
    route.fulfill({
      status: 503,
      json: { error: { code: "unavailable", message: "Try again shortly.", requestId: "stance-test-id" } },
    }),
  );
  await page.goto(`/ideas/${IDEA.slug}`);
  await page
    .getByRole("button", { name: /^Important/ })
    .first()
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Try again shortly. Quote this id if you report the problem: stance-test-id",
  );
});

/**
 * The whole contribution loop as one newcomer: join → propose → take a stance → evaluate → add a claim →
 * attach evidence → argue → comment → publish a revision → sign out.
 */
test("a newcomer joins, proposes an idea and develops it", async ({ page }) => {
  const errors = watchErrors(page);
  const id = Date.now().toString(36);
  const title = `Tidal-powered desalination commons ${id}`;

  await test.step("join", async () => {
    await page.goto("/join");
    await page.getByLabel("Name").fill("Erin Test");
    await page.getByLabel("Handle").fill(`e2e-${id}`);
    await page.getByLabel("Email").fill(`e2e-${id}@example.test`);
    await page.getByLabel("Password").fill("a-long-test-password");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("button", { name: "Your account" })).toBeVisible();
  });

  await test.step("propose an idea", async () => {
    await page.getByRole("link", { name: "Propose an idea" }).first().click();
    await expect(page).toHaveURL(/\/new$/);
    await page.getByLabel("What possibility do you want humanity to remember?").fill(title);
    await page
      .getByLabel("In two or three sentences")
      .fill(
        "Coastal communities co-own small tidal turbines that power membrane desalination for drinking water.",
      );
    await page.getByRole("group", { name: "Topics" }).getByRole("button", { name: "Energy" }).click();
    await page.getByRole("button", { name: /How it might work/ }).click();
    await page
      .getByLabel("How it might work")
      .fill("Tidal turbines drive pumps directly; surplus charges a shared battery.");
    await page.getByRole("button", { name: "Add to the archive" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  });

  await test.step("take a stance", async () => {
    // The header's toggle (the sidebar's "Perspectives" box shares its state).
    const important = page.getByRole("button", { name: /^Important/ }).first();
    await important.click();
    await expect(important).toHaveAttribute("aria-pressed", "true");
  });

  await test.step("evaluate it", async () => {
    await page.getByRole("button", { name: "Evaluate", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByText("Transformative", { exact: true }).click();
    await dialog.getByText("Plausible within decades", { exact: true }).click();
    await expect(dialog.getByText("2 of 6")).toBeVisible();
    await dialog.getByRole("button", { name: "Save evaluation" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Update evaluation", exact: true })).toBeVisible();
  });

  await test.step("add a claim and attach evidence", async () => {
    await page
      .getByRole("navigation", { name: "Idea sections" })
      .getByRole("link", { name: /Claims & evidence/ })
      .click();
    await page.getByRole("button", { name: "Add a claim" }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Statement")
      .fill("Small tidal turbines can deliver steady power for membrane desalination.");
    await dialog.getByText("Mechanism", { exact: true }).click();
    await dialog.getByRole("button", { name: "Add claim" }).click();
    await expect(dialog).toBeHidden();
    const claim = page.locator("article[id^='claim-']").first();
    await expect(claim).toContainText("Small tidal turbines");

    await claim.getByRole("button", { name: "Attach evidence" }).click();
    const evidence = page.getByRole("dialog");
    await evidence.getByLabel("Title").fill("Field report on micro-tidal installations");
    await evidence
      .getByLabel("What does it show about the claim?")
      .fill("Output was predictable to within ten percent over a year.");
    await evidence.getByLabel(/What does it NOT establish/).fill("A single site; costs were not measured.");
    await evidence.getByRole("button", { name: "Attach evidence" }).click();
    await expect(evidence).toBeHidden();
    await expect(claim.getByText("Does not establish:")).toBeVisible();
  });

  await test.step("argue and comment", async () => {
    await page
      .getByRole("navigation", { name: "Idea sections" })
      .getByRole("link", { name: /Discussion/ })
      .click();
    await page.getByRole("button", { name: "Make an argument" }).click();
    await page.getByText("Opposes", { exact: true }).click();
    await page.getByLabel("In one line").fill("Biofouling may make maintenance too costly");
    await page
      .getByLabel("Reasoning")
      .fill("Marine growth on turbines and membranes raises operating costs in warm waters.");
    await page.getByRole("button", { name: "Post argument" }).click();
    await expect(
      page.getByRole("heading", { name: "Biofouling may make maintenance too costly" }),
    ).toBeVisible();

    await page.getByRole("button", { name: /Add a comment/ }).click();
    await page.getByRole("textbox", { name: "Comment" }).fill("Has anyone modelled this for estuaries?");
    await page.getByRole("button", { name: "Post", exact: true }).click();
    await expect(page.getByText("Has anyone modelled this for estuaries?")).toBeVisible();
  });

  await test.step("publish a revision as the idea's steward", async () => {
    await page.getByRole("link", { name: "Edit", exact: true }).click();
    await page
      .getByLabel("In two or three sentences")
      .fill(
        "Coastal communities co-own small tidal turbines that power membrane desalination, sharing the water and the upkeep.",
      );
    await page.getByLabel("What changed and why").fill("Clarified shared upkeep");
    await page.getByRole("button", { name: "Publish revision" }).click();
    await expect(page).not.toHaveURL(/\/edit$/);
    await expect(page.getByText(/sharing the water and the upkeep/)).toBeVisible();
    await page
      .getByRole("navigation", { name: "Idea sections" })
      .getByRole("link", { name: /History/ })
      .click();
    await expect(page.getByText("Clarified shared upkeep").first()).toBeVisible();
  });

  await test.step("sign out", async () => {
    await page.getByRole("button", { name: "Your account" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  expect(errors).toEqual([]);
});
