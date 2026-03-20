import paletteCss from "./palette.css";
import paletteHtml from "./palette.html";
import { VideoList } from "./messaging";

export async function showPalette(
	lists: VideoList[],
): Promise<{ success: boolean; listId?: string }> {
	return new Promise((resolve) => {
		const container = document.createElement("div");
		const shadow = container.attachShadow({ mode: "open" });

		shadow.innerHTML = `<style>${paletteCss}</style>${paletteHtml}`;

		const dialog = shadow.getElementById("palette-dialog") as HTMLDialogElement;
		const closeBtn = shadow.getElementById("close-btn") as HTMLButtonElement;
		const searchInput = shadow.getElementById(
			"search-input",
		) as HTMLInputElement;
		const listContainer = shadow.getElementById(
			"list-container",
		) as HTMLDivElement;

		closeBtn.onclick = () => dialog.close();

		const sorted = [...lists].sort((a, b) => b.createdAt - a.createdAt);
		let filteredLists = sorted.slice(0, 5);
		let selectedIndex = 0;

		const render = () => {
			listContainer.innerHTML = "";
			if (filteredLists.length === 0) {
				const empty = document.createElement("div");
				empty.style.textAlign = "center";
				empty.style.padding = "20px 0";
				empty.textContent = "No lists found.";
				listContainer.appendChild(empty);
				return;
			}

			for (let i = 0; i < filteredLists.length; i++) {
				const list = filteredLists[i];
				const item = document.createElement("div");
				item.className = "list-item";
				if (i === selectedIndex) {
					item.classList.add("selected");
				}

				const info = document.createElement("div");
				info.className = "list-info";

				if (i < 5) {
					const number = document.createElement("span");
					number.className = "list-number";
					number.textContent = (i + 1).toString();
					info.appendChild(number);
				}

				const name = document.createElement("span");
				name.textContent = list.name;
				info.appendChild(name);

				const count = document.createElement("span");
				count.className = "count";
				count.textContent = list.videos.length.toString();

				item.appendChild(info);
				item.appendChild(count);

				item.onclick = () => {
					resolve({ success: true, listId: list.id });
					dialog.close();
				};
				listContainer.appendChild(item);
			}
		};

		searchInput.addEventListener("input", () => {
			const q = searchInput.value.trim().toLowerCase();
			if (q === "") {
				filteredLists = sorted.slice(0, 5);
			} else {
				filteredLists = sorted.filter((l) => l.name.toLowerCase().includes(q));
			}
			selectedIndex = 0;
			render();
		});

		searchInput.addEventListener("keydown", (e) => {
			e.stopPropagation(); // prevent youtube hotkeys
			if (e.key === "ArrowDown") {
				e.preventDefault();
				if (filteredLists.length > 0) {
					selectedIndex = (selectedIndex + 1) % filteredLists.length;
					render();
					(
						listContainer.children[selectedIndex] as HTMLElement
					)?.scrollIntoView({ block: "nearest" });
				}
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				if (filteredLists.length > 0) {
					selectedIndex =
						(selectedIndex - 1 + filteredLists.length) % filteredLists.length;
					render();
					(
						listContainer.children[selectedIndex] as HTMLElement
					)?.scrollIntoView({ block: "nearest" });
				}
			} else if (e.key === "Enter") {
				e.preventDefault();
				if (filteredLists.length > 0 && selectedIndex < filteredLists.length) {
					resolve({ success: true, listId: filteredLists[selectedIndex].id });
					dialog.close();
				}
			} else if (e.key >= "1" && e.key <= "5" && searchInput.value === "") {
				e.preventDefault();
				const index = parseInt(e.key) - 1;
				if (index < filteredLists.length) {
					resolve({ success: true, listId: filteredLists[index].id });
					dialog.close();
				}
			} else if (e.key === "Escape") {
				e.preventDefault();
				dialog.close();
			}
		});

		searchInput.addEventListener("keyup", (e) => e.stopPropagation());
		searchInput.addEventListener("keypress", (e) => e.stopPropagation());

		dialog.addEventListener("close", () => {
			container.remove();
			resolve({ success: false });
		});

		document.body.appendChild(container);
		render();
		dialog.showModal();
		searchInput.focus();
	});
}
