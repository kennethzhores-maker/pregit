async function main() {
  const { runSync } = await import("../src/lib/sync/run-sync");
  const jobArg = process.argv[2];
  const job =
    jobArg === "hourly" ||
    jobArg === "nightly" ||
    jobArg === "seed" ||
    jobArg === "squads"
      ? jobArg
      : "seed";

  const result = await runSync(job);
  console.log(JSON.stringify(result, null, 2));

  if (result.status === "failed") {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
