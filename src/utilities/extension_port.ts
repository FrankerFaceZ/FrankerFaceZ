import Module from "./module";

type PortType = {
	postMessage: (msg: any) => void;
}

export function installPort(module: Module) {
	let port: PortType | null = null;

	function initialize() {
		try {
			// Try connecting with externally_connectable first.
			const cp = port = chrome.runtime.connect(document.body.dataset.ffzExtension!, {
				name: 'ffz-ext-port'
			});

			cp.onMessage.addListener(msg => {
				module.emit('ext:message', msg);
			});

			cp.onDisconnect.addListener(p => {
				module.log.warn('Extension port disconnected.', (p as any)?.error ?? chrome.runtime.lastError);
				port = null;
			});

			return;
		} catch(err) {
			module.log.info('Unable to connect using externally_connectable, falling back to bridge.');
		}

		window.addEventListener('message', evt => {
			if ( evt.source !== window || ! evt.data || evt.data.ffz_from_worker )
				return;

			module.emit('ext:message', evt.data);
		});

		port = {
			postMessage(msg) {
				window.postMessage({
					ffz_to_worker: true,
					...msg
				}, window.location.origin);
			}
		};
	}

	module.on('ext:post-message', msg => {
		if ( ! port )
			initialize();

		port!.postMessage(msg);
	});
}
