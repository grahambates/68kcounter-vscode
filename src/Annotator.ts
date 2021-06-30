import {
  Disposable,
  Range,
  StatusBarAlignment,
  StatusBarItem,
  TextDocument,
  TextDocumentChangeEvent,
  TextEditor,
  TextEditorDecorationType,
  TextEditorSelectionChangeEvent,
  ThemeColor,
  window,
  workspace,
} from "vscode";
import parse, {
  formatTiming,
  Level,
  timingLevel,
  calculateTotals,
  Line,
} from "68kcounter";

const colorPre = new ThemeColor("textPreformat.foreground");
const colors: Record<Level, ThemeColor | string> = {
  [Level.VHigh]: "red",
  [Level.High]: new ThemeColor("editorError.foreground"),
  [Level.Med]: new ThemeColor("editorWarning.foreground"),
  [Level.Low]: new ThemeColor("editorInfo.foreground"),
};

interface Annotation {
  text: string;
  hoverMessage: string;
  color: ThemeColor;
}

/**
 * Manages timing annotations for an editor instance
 */
export class Annotator implements Disposable {
  private document: TextDocument;
  private lines: Line[] = [];
  private statusBarItem: StatusBarItem;
  private disposable: Disposable;
  private visible = false;
  private type: TextEditorDecorationType;

  constructor(document: TextDocument) {
    this.type = window.createTextEditorDecorationType({
      light: {
        before: {
          backgroundColor: "rgba(0, 0, 0, .02)",
        },
      },
      dark: {
        before: {
          backgroundColor: "rgba(255, 255, 255,.02)",
        },
      },
      before: {
        width: "210px",
        borderColor: new ThemeColor("editorInfo.foreground"),
        textDecoration: `;border-width: 0 2px 0 0; border-style: solid; margin-right: 26px; padding: 0 6px; text-align: right;`,
      },
      after: {
        contentText: " ",
      },
    });

    this.document = document;
    const subscriptions: Disposable[] = [];
    workspace.onDidChangeTextDocument(this.onChange, this, subscriptions);
    window.onDidChangeTextEditorSelection(
      this.onSelection,
      this,
      subscriptions
    );
    window.onDidChangeActiveTextEditor(
      this.onChangeEditor,
      this,
      subscriptions
    );

    this.disposable = Disposable.from(...subscriptions);
    this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
    this.show();
  }

  dispose(): void {
    this.hide();
    this.statusBarItem.dispose();
    this.disposable.dispose();
  }

  toggle(): void {
    this.visible ? this.hide() : this.show();
  }

  show(): void {
    this.visible = true;

    let text = this.document.getText();
    text = text.replace(/(\\n|"|%%)/g, "");
    this.lines = parse(text);

    const annotations = this.lines.map(this.buildAnnotation);

    window.activeTextEditor?.setDecorations(
      this.type,
      annotations.map(({ text, color, hoverMessage }, i) => ({
        range: new Range(i, 0, i, 0),
        hoverMessage,
        renderOptions: { before: { contentText: text || " ", color } },
      }))
    );
    this.showTotals();
  }

  hide(): void {
    this.visible = false;
    window.activeTextEditor?.setDecorations(this.type, []);
    this.statusBarItem.hide();
  }

  private showTotals() {
    const selection = window.activeTextEditor?.selection;
    if (selection && selection.start.line !== selection.end.line) {
      // Selection totals:
      const selectedLines = this.lines.slice(
        selection.start.line,
        selection.end.line + 1
      );
      const totals = calculateTotals(selectedLines);
      let text = "Length: " + totals.words;
      text += " Cycles: " + formatTiming(totals.min);
      if (totals.isRange) {
        text += " " + formatTiming(totals.max);
      }
      this.statusBarItem.text = text;
    } else {
      // File totals:
      const totals = calculateTotals(this.lines);
      this.statusBarItem.text = "Length: " + totals.words;
    }
    this.statusBarItem.show();
  }

  /**
   * Get annotation text and color for a line of code
   */
  private buildAnnotation(line: Line): Annotation {
    const { words, timings } = line;

    let text = "";
    let color = colorPre;
    if (timings) {
      if (Array.isArray(timings)) {
        text += timings.map(formatTiming).join(" ");
      } else {
        text += formatTiming(timings);
      }
      if (timings) {
        const level = timingLevel(
          Array.isArray(timings) ? timings[0] : timings
        );
        color = colors[level];
      }
    }
    if (words) {
      text += " " + words;
    }
    const hoverMessage = "";
    return { text, color, hoverMessage };
  }

  private onSelection(e: TextEditorSelectionChangeEvent) {
    if (this.visible && e.textEditor.document === this.document) {
      this.showTotals();
    }
  }

  private onChangeEditor(e?: TextEditor) {
    if (this.visible && e?.document === this.document) {
      this.show();
    }
  }

  private onChange(e: TextDocumentChangeEvent) {
    if (this.visible && e.document === this.document) {
      if (this.visible) {
        this.show();
      }
    }
  }
}
