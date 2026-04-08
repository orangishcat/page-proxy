export const createReviewEditorSetupGate = () => {
  let status: "idle" | "creating" | "failed" = "idle";

  return {
    begin() {
      if (status !== "idle") {
        return false;
      }

      status = "creating";
      return true;
    },
    succeed() {
      status = "idle";
    },
    fail() {
      status = "failed";
    },
    reset() {
      status = "idle";
    },
  };
};
