import type { Transferable } from "node:worker_threads";

export function httpPolyfills(): void {
	if (typeof MessageChannel !== "undefined") {
		return;
	}

	class MockMessagePort {
		onmessage: ((event: MessageEvent) => void) | undefined;
		onmessageerror: ((event: MessageEvent) => void) | undefined;

		addEventListener() {}
		close() {}

		dispatchEvent(_event: Event): boolean {
			return false;
		}

		postMessage(_message: unknown, _transfer: Transferable[] = []) {}
		removeEventListener() {}
		start() {}
	}

	class MockMessageChannel {
		port1: MockMessagePort;
		port2: MockMessagePort;

		constructor() {
			this.port1 = new MockMessagePort();
			this.port2 = new MockMessagePort();
		}
	}

	globalThis.MessageChannel =
		MockMessageChannel as unknown as typeof MessageChannel;
}

httpPolyfills();

export { betterAuth } from "./middleware";
export { HttpRouter } from "./router";
