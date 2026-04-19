# SpectraForge

SpectraForge is a high-performance, web-based Fast Fourier Transform (FFT) image editor designed specifically for real-world structured noise removal. Built natively for the browser, it allows users to perform real-time frequency domain manipulation to clean scanned documents, remove moire patterns, and eliminate periodic noise without requiring robust desktop software.

## Features

- **Real-Time Dual-Domain Rendering**: Seamlessly interact with the spatial image layer and its mathematical frequency representation side-by-side.
- **Pure-JS Web Worker Engine**: Zero-copy 2D Cooley-Tukey Radix-2 FFT engine offloads heavy computations to a background thread, ensuring a smooth, 60 FPS front-end experience.
- **Automatic Spike Detection**: An intelligent algorithm parses the magnitude spectrum to automatically detect and list periodic interference peaks, complete with instantaneous isolation.
- **Star Brush Technology**: A specialized geometric frequency masking brush designed to target symmetric noise patterns efficiently while preserving organic details.
- **Conjugate Symmetry Enforcement**: Real-time mirroring ensures all mask operations mathematically preserve the integrity of the inverse Fourier transformation.
- **Advanced Colormapping**: Scientific-grade grayscale visualization overlaying live frequency masking properties natively on HTML5 Canvas.

## Workflow

1. **Upload**: Drag and drop an image (JPG, PNG, WebP) into the upload zone.
2. **Analysis**: The engine instantly routes the image to the Web Worker for forward FFT mapping and spike detection.
3. **Filter**: Clear periodic noise natively. Detected spikes will populate in the tool pane. Use Auto-Remove, or manually paint out anomalies with the Notch Filter, Directional Wedge, or Star Brush.
4. **Compare**: View interactive real-time results via the spatial domain before/after comparison slider.
5. **Export**: Export the final structure-separated image directly out of the browser.

## Tech Stack

- **Framework**: Next.js (App Router, Turbopack enabled)
- **State Management**: Zustand (with surgical single-component subscription architecture)
- **Styling**: Tailwind CSS, Shadcn UI
- **Processing**: Pure TypeScript Web Workers (ArrayBuffer sharing)

## Getting Started

### Prerequisites

Ensure you have Node.js 18.0 or later installed on your system.

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/yourusername/spectraforge.git
cd spectraforge
npm install
```

### Running the Application

Start the local development server:

```bash
npm run dev
```

Open a web browser and navigate to `http://localhost:3000`.

## Architecture Note

SpectraForge uses zero-copy memory patterns by transferring `Float32Array` buffers between the UI thread and the worker pool. This negates serialization overhead commonly associated with browser-based WebGL/WASM computation environments, establishing a lean operational footprint on nearly any machine.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss the scope and rationale.

## License

This project is open-source and available under the terms of the MIT License.
