const RULE_ID_ROOT = 1;
const RULE_ID_PATH = 2;

async function enableUserRedirect(userIndex: number) {
	await chrome.declarativeNetRequest.updateDynamicRules({
		removeRuleIds: [RULE_ID_ROOT, RULE_ID_PATH],
		addRules: [
			{
				id: RULE_ID_ROOT,
				priority: 1,
				action: {
					type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
					redirect: {
						regexSubstitution: `https://classroom.google.com/u/${userIndex}/`,
					},
				},
				condition: {
					regexFilter: "^https://classroom\\.google\\.com/?$",
					resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
				},
			},
			{
				id: RULE_ID_PATH,
				priority: 1,
				action: {
					type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
					redirect: {
						regexSubstitution: `https://classroom.google.com/u/${userIndex}/\\1`,
					},
				},
				condition: {
					regexFilter: "^https://classroom\\.google\\.com/([^u].*)$",
					resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
				},
			},
		],
	});
}

async function disableUserRedirect() {
	await chrome.declarativeNetRequest.updateDynamicRules({
		removeRuleIds: [RULE_ID_ROOT, RULE_ID_PATH],
	});
}

async function syncRedirectRule() {
	const storage = await chrome.storage.local.get([
		"userSwitch.enabled",
		"userSwitch.userIndex",
	]);
	const enabled = storage["userSwitch.enabled"] ?? false;
	const userIndex = storage["userSwitch.userIndex"] ?? 0;

	if (enabled) {
		await enableUserRedirect(userIndex);
	} else {
		await disableUserRedirect();
	}
}

function handleStorageChange(changes: {
	[key: string]: chrome.storage.StorageChange;
}) {
	if (changes["userSwitch.enabled"] || changes["userSwitch.userIndex"]) {
		syncRedirectRule();
	}
}

chrome.storage.onChanged.addListener(handleStorageChange);
chrome.runtime.onInstalled.addListener(syncRedirectRule);
chrome.runtime.onStartup.addListener(syncRedirectRule);
