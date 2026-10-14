import { calculate, type CalculateInput } from "./logic";
self.onmessage = (event: MessageEvent<CalculateInput>) => {
  try {
    self.postMessage({ result: calculate(event.data) });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error ? error.message : "Beräkningen misslyckades.",
    });
  }
};
