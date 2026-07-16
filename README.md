# Neon Spotlight

![Neon Spotlight highlighting an element inside a browser](assets/neon-spotlight-hero.png)

Highlight any element on any webpage with a customizable neon border. Neon Spotlight is a lightweight, open-source Chrome extension designed for screen recordings, tutorials, presentations, demos, and focused browsing.

## Features

- Highlight any visible webpage element with a configurable keyboard key
- Add an animated neon border when clicking buttons
- Hold the highlight key to keep an element in focus
- Dim everything outside the selected element
- Choose from six colors or enable random colors
- Adjust shine, contrast, thickness, border gap, dim strength, and animation speed
- Save settings automatically with Chrome sync
- Respect the browser's reduced-motion preference

## Installation

Neon Spotlight is not yet published in the Chrome Web Store. You can install it locally in developer mode:

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** in the upper-right corner.
4. Select **Load unpacked**.
5. Choose the project folder.

## How to use it

1. Select the Neon Spotlight icon in the Chrome toolbar.
2. Choose a highlight key and customize the visual effect.
3. Move your pointer over any element on a webpage.
4. Press the selected key to spotlight the element.
5. Click a button to display the optional click effect.

Chrome does not run extensions on internal pages such as `chrome://extensions`. Test Neon Spotlight on a regular website after loading it.

## Settings

| Setting | Purpose |
| --- | --- |
| Highlight Key | Select Caps Lock, Control, Shift, Alt, or Command |
| Click Effect | Show the animation when webpage buttons are clicked |
| Random Color | Choose a different color for each effect |
| Dim Background | Darken the area outside the highlighted element |
| Shine and Contrast | Control the intensity and clarity of the glow |
| Thickness and Border Gap | Adjust the border size and distance from the element |
| Dim Strength | Control how dark the surrounding page becomes |
| Speed | Adjust the animation timing |

## Privacy

Neon Spotlight does not collect, store, sell, or transmit browsing data. The extension runs locally in your browser. Your visual preferences are saved through `chrome.storage.sync` so they can follow your Chrome profile.

The extension requests access to webpages because it must draw the highlight around page elements. It does not send page content to an external server.

## Development

The project uses plain HTML, CSS, and JavaScript with no build step or runtime dependencies.

```text
manifest.json       Chrome extension configuration
popup.html          Settings interface
popup.css           Settings interface styling
popup.js            Settings and storage behavior
content-effect.js   Page targeting, highlighting, and animation
```

After making a change, reload the extension from `chrome://extensions` and refresh the webpage you are testing.

Basic syntax validation:

```bash
node --check popup.js
node --check content-effect.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json', 'utf8'))"
```

## Contributing

Contributions are welcome. Please open an issue before beginning a substantial change so the approach can be discussed. For smaller fixes, create a focused pull request that explains what changed and how you tested it.

## License

Neon Spotlight is available under the [MIT License](LICENSE).
