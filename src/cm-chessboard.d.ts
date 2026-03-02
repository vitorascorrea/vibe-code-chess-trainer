declare module 'cm-chessboard' {
  export const COLOR: { white: string; black: string };
  export const INPUT_EVENT_TYPE: {
    moveInputStarted: string;
    validateMoveInput: string;
    moveInputFinished: string;
    moveInputCanceled: string;
  };
  export const FEN: { start: string; empty: string };
  export const BORDER_TYPE: { none: string; thin: string; frame: string };

  export class Chessboard {
    constructor(context: HTMLElement, props?: Record<string, unknown>);
    setPosition(fen: string, animated?: boolean): Promise<void>;
    setOrientation(color: string, animated?: boolean): void;
    enableMoveInput(callback: (event: { type: string; squareFrom: string; squareTo: string }) => boolean | void, color?: string): void;
    disableMoveInput(): void;
    destroy(): void;
    // Added by extensions:
    addArrow?: (type: unknown, from: string, to: string) => void;
    removeArrows?: (type?: unknown, from?: string, to?: string) => void;
    addMarker?: (type: unknown, square: string) => void;
    removeMarkers?: (type?: unknown, square?: string) => void;
  }
}

declare module 'cm-chessboard/src/extensions/arrows/Arrows.js' {
  import { Chessboard } from 'cm-chessboard';
  export const ARROW_TYPE: {
    default: { class: string };
    success: { class: string };
    secondary: { class: string };
    warning: { class: string };
    info: { class: string };
    danger: { class: string };
  };
  export class Arrows {
    constructor(chessboard: Chessboard, props?: Record<string, unknown>);
  }
}

declare module 'cm-chessboard/src/extensions/markers/Markers.js' {
  import { Chessboard } from 'cm-chessboard';
  export const MARKER_TYPE: {
    frame: { class: string; slice: string };
    square: { class: string; slice: string };
    dot: { class: string; slice: string };
    circle: { class: string; slice: string };
    bevel: { class: string; slice: string };
  };
  export class Markers {
    constructor(chessboard: Chessboard, props?: Record<string, unknown>);
  }
}

declare module 'cm-chessboard/assets/chessboard.css' {
  const content: string;
  export default content;
}

declare module 'cm-chessboard/assets/extensions/arrows/arrows.css' {
  const content: string;
  export default content;
}

declare module 'cm-chessboard/assets/extensions/markers/markers.css' {
  const content: string;
  export default content;
}
