export function deriveRemediationExecutionStatus(fixPassed: boolean, testPassed: boolean): "succeeded" | "failed" {
  return fixPassed && testPassed ? "succeeded" : "failed";
}
