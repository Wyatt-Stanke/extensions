# Changelog

## [1.4.0](https://github.com/Wyatt-Stanke/extensions/compare/collapse-v1.3.0...collapse-v1.4.0) (2026-04-24)


### Features

* **gclassroom:** start working on extension ([a013555](https://github.com/Wyatt-Stanke/extensions/commit/a013555c0d7f29c0bb343c7482dc483396a95015))


### Bug Fixes

* issues with layout ([f6ff7d6](https://github.com/Wyatt-Stanke/extensions/commit/f6ff7d618ee9cc9b7645a66838e8dc6ff4e82edd))
* move some css to shared ([564bf8e](https://github.com/Wyatt-Stanke/extensions/commit/564bf8eb6c0c2d9e1be4d098ba4dd5493154c5d7))

## [1.3.0](https://github.com/Wyatt-Stanke/extensions/compare/collapse-v1.2.0...collapse-v1.3.0) (2026-04-21)


### Features

* **collapse:** add export/import for video lists ([4b08b4a](https://github.com/Wyatt-Stanke/extensions/commit/4b08b4a835f1e0afd7ab9d7bdd2e84d0abf560d8))
* **collapse:** add more layout options for collapse page ([0c4c3cb](https://github.com/Wyatt-Stanke/extensions/commit/0c4c3cbc62131f5ef5cdc9a260ba44b41a15c5d7))
* **collapse:** rewrite popup with JSX and shared UI utilities ([ff8c944](https://github.com/Wyatt-Stanke/extensions/commit/ff8c944d4fb7a27d5f73f85845cd37622566e34d))

## [1.2.0](https://github.com/Wyatt-Stanke/extensions/compare/collapse-v1.1.1...collapse-v1.2.0) (2026-03-26)


### Features

* add dark mode support ([541516f](https://github.com/Wyatt-Stanke/extensions/commit/541516f4d63622e4ba13892e5ec665bfc6d9255e))
* add palette command shortcut (CTRL+SHIFT+U) ([6a992fe](https://github.com/Wyatt-Stanke/extensions/commit/6a992fee9505830b80f2125e41eee2624466d6b9))
* add playlist support to video handling and UI ([9eeb542](https://github.com/Wyatt-Stanke/extensions/commit/9eeb54229d6024f4283a2f6f94f69c27c5d0c7e4))
* allow adding all tabs in current window to a list ([666be94](https://github.com/Wyatt-Stanke/extensions/commit/666be94974b48ce15c030c69d4d7512934e98811))
* ui revamp ([666be94](https://github.com/Wyatt-Stanke/extensions/commit/666be94974b48ce15c030c69d4d7512934e98811))


### Bug Fixes

* consistent formatting for no ID in collapsed page ([7d24085](https://github.com/Wyatt-Stanke/extensions/commit/7d2408593d80b6e76bc133eab187ad8b7c6b29d4))
* retrieve video information in parallel ([b2fa2b3](https://github.com/Wyatt-Stanke/extensions/commit/b2fa2b3eaa13c7c5ad612b37eaeca3afba42ab72))

## [1.1.1](https://github.com/Wyatt-Stanke/extensions/compare/collapse-v1.1.0...collapse-v1.1.1) (2026-03-16)


### Bug Fixes

* remove unnecessary host_permissions for collapse ([d41b44d](https://github.com/Wyatt-Stanke/extensions/commit/d41b44d5c5718c2cfb4d6d75d4affa970433d541))

## [1.1.0](https://github.com/Wyatt-Stanke/extensions/compare/collapse-v1.0.0...collapse-v1.1.0) (2026-03-16)


### Features

* add functionality to add hovered YouTube links to the most recent list via keyboard shortcut ([fe67d68](https://github.com/Wyatt-Stanke/extensions/commit/fe67d68e4c7638af0e814cbe7d426862b3d882ec))
* enhance list management and user interface for collapsing tabs ([861ddbf](https://github.com/Wyatt-Stanke/extensions/commit/861ddbf2dda336d93ffc295385fd1323fe2cf42c))
* implement add to existing list functionality and auto-delete empty lists ([5910b18](https://github.com/Wyatt-Stanke/extensions/commit/5910b18bddd1dc1ec14cf516c75e358106115897))
* implement context menu for adding videos to lists and add keyboard shortcut for recent list ([0df130a](https://github.com/Wyatt-Stanke/extensions/commit/0df130af7b573130cc0cdced56cbdb80fbaf2dcd))
* support adding videos from selected text via context menu ([4fc70b3](https://github.com/Wyatt-Stanke/extensions/commit/4fc70b3d606c103564acfd96d612f2e0f43598c6))


### Bug Fixes

* ensure only relevant tabs are closed when collapsing or adding to lists ([521c89b](https://github.com/Wyatt-Stanke/extensions/commit/521c89b79337a62732bfc575ccb3599cb3282595))
* improve tab count display for singular and plural cases ([9af50fb](https://github.com/Wyatt-Stanke/extensions/commit/9af50fbe3ae86c5ab86eb52bdd20e582a7203177))
* keyboard shortcut resiliency ([6a44a30](https://github.com/Wyatt-Stanke/extensions/commit/6a44a30361c5af555086222399de22895f213e38))
* new icon ([716257c](https://github.com/Wyatt-Stanke/extensions/commit/716257cfd90420b73d417c8d36e379bff301c73f))
* remove alt+c functionality ([d6aeb82](https://github.com/Wyatt-Stanke/extensions/commit/d6aeb82a928cf5f5f7055316da871de0ee312903))
* remove prefix from collapsed list ([63b371a](https://github.com/Wyatt-Stanke/extensions/commit/63b371a441d0a81181bd38808d5102a672f2f6ad))
* revert ([e6750bb](https://github.com/Wyatt-Stanke/extensions/commit/e6750bbff0c092f86f0f3c4613845e785433ae21))
* try refreshing tabs if unable to get tab data ([19b59c6](https://github.com/Wyatt-Stanke/extensions/commit/19b59c62a23ba44f4e0f7e17e3069df9bce402d4))

## 1.0.0 (2026-03-16)

### Features

* Initial release of Collapse — YouTube Tab Manager
* Collapse multiple highlighted YouTube tabs into a persistent video list
* Save and restore video watch progress with timestamps
* Multiple named lists with merge support
* Reopen videos at saved timestamps
