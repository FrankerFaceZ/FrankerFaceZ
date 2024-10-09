const browser = ((globalThis as any).browser ?? globalThis.chrome) as typeof globalThis.chrome;

browser.runtime.onInstalled.addListener(() => {
	browser.action.disable();
});

browser.action.onClicked.addListener(tab => {
	if ( ! tab?.id )
		return;

	browser.tabs.sendMessage(tab.id, {
		type: 'ffz_to_page',
		data: {
			ffz_type: 'open-settings'
		}
	});
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
	const type = message?.type;
	if ( ! type || ! sender?.tab?.id )
		return;

	if ( type === 'ffz_not_supported' )
		browser.action.disable(sender.tab.id);

	else if ( type === 'ffz_injecting' )
		browser.action.enable(sender.tab.id);

	console.log('got message', message, sender);
});
