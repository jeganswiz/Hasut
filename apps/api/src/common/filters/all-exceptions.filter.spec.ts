import { HttpStatus } from "@nestjs/common";
import type { ArgumentsHost } from "@nestjs/common";
import { AllExceptionsFilter } from "./all-exceptions.filter";
import { HasutHttpException } from "../errors/hasut-http.exception";

describe("AllExceptionsFilter", () => {
  const filter = new AllExceptionsFilter();

  function hostWith(requestId: string): {
    host: ArgumentsHost;
    json: jest.Mock;
    status: jest.Mock;
  } {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ requestId, header: () => requestId }),
      }),
    } as unknown as ArgumentsHost;
    return { host, json, status };
  }

  it("maps HasutHttpException to a structured failure", () => {
    const { host, json, status } = hostWith("req-1");
    filter.catch(
      new HasutHttpException("NOT_FOUND", "Missing resource", HttpStatus.NOT_FOUND),
      host,
    );
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: { code: "NOT_FOUND", message: "Missing resource" },
      meta: { requestId: "req-1" },
    });
  });

  it("hides unexpected error details from the client", () => {
    const { host, json, status } = hostWith("req-2");
    filter.catch(new Error("secret internals"), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      meta: { requestId: "req-2" },
    });
  });
});
