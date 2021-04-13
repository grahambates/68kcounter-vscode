import {
  Disposable,
  Range,
  StatusBarAlignment,
  StatusBarItem,
  TextDocument,
  TextDocumentChangeEvent,
  TextDocumentContentChangeEvent,
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

type LineDecoration = { line: Line; decorationType: TextEditorDecorationType };

const colorPre = new ThemeColor("textPreformat.foreground");
const width = "210px";
const colors: Record<Level, ThemeColor | string> = {
  [Level.VHigh]: "red",
  [Level.High]: new ThemeColor("editorError.foreground"),
  [Level.Med]: new ThemeColor("editorWarning.foreground"),
  [Level.Low]: new ThemeColor("editorInfo.foreground"),
};

/**
 * Manages timing annotations for an editor instance
 */
export class Annotator implements Disposable {
  private document: TextDocument;
  private lineDecorations: LineDecoration[] | null = null;
  private statusBarItem: StatusBarItem;
  private disposable: Disposable;

  constructor(document: TextDocument) {
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
    this.isVisible() ? this.hide() : this.show();
  }

  show(): void {
    this.lineDecorations = this.buildDecorations(this.document.getText());
    this.lineDecorations?.forEach(({ decorationType }, i) => {
      window.activeTextEditor?.setDecorations(decorationType, [
        new Range(i, 0, i, 0),
      ]);
    });
    this.showTotals();
  }

  hide(): void {
    if (this.isVisible()) {
      this.lineDecorations?.forEach(({ decorationType }) =>
        decorationType.dispose()
      );
    }
    this.lineDecorations = null;
    this.hideTotals();
  }

  isVisible(): boolean {
    return this.lineDecorations !== null;
  }

  private showTotals() {
    if (this.lineDecorations) {
      const selection = window.activeTextEditor?.selection;
      if (selection && selection.start.line !== selection.end.line) {
        // Selection totals:
        const selectedLines = this.lineDecorations
          .slice(selection.start.line, selection.end.line + 1)
          .map((n) => n.line);
        const totals = calculateTotals(selectedLines);
        let text = "Length: " + totals.words;
        text += " Cycles: " + formatTiming(totals.min);
        if (totals.isRange) {
          text += " " + formatTiming(totals.max);
        }
        this.statusBarItem.text = text;
      } else {
        // File totals:
        const totals = calculateTotals(
          this.lineDecorations?.map((n) => n.line)
        );
        this.statusBarItem.text = "Length: " + totals.words;
      }
      this.statusBarItem.show();
    }
  }

  private hideTotals() {
    this.statusBarItem.hide();
  }

  /**
   * Build an array containing decorations for each line of code
   */
  private buildDecorations(text: string) {
    // Clean up inline ASM in C
    text = text.replace(/(\\n|"|%%)/g, "");

    return parse(text).map((line) => {
      const { words, timings } = line;

      let contentText = "";
      let color = colorPre;
      if (words) {
        contentText += words + " ";
      }
      if (timings) {
        if (Array.isArray(timings)) {
          contentText += timings.map(formatTiming).join(" ");
        } else {
          contentText += formatTiming(timings);
        }
        const level = timingLevel(
          Array.isArray(timings) ? timings[0] : timings
        );
        color = colors[level];
      }

      const decorationType = window.createTextEditorDecorationType({
        before: {
          contentText,
          color,
          width,
        },
      });

      return { decorationType, line };
    });
  }

  private onSelection(e: TextEditorSelectionChangeEvent) {
    if (this.isVisible() && e.textEditor.document === this.document) {
      this.showTotals();
    }
  }

  private onChangeEditor(e?: TextEditor) {
    if (this.isVisible()) {
      if (e?.document === this.document) {
        this.show();
      } else {
        this.hideTotals();
      }
    }
  }

  private onChange(e: TextDocumentChangeEvent) {
    if (this.isVisible() && e.document === this.document) {
      e.contentChanges.forEach((c) => this.onContentChange(c));
      this.showTotals();
    }
  }

  private onContentChange(change: TextDocumentContentChangeEvent) {
    if (!this.lineDecorations) {
      return;
    }

    const { range, text } = change;
    const sourceLineCount = range.end.line - range.start.line + 1;
    const newLines = text.split("\n").length;
    const changedLinesText = this.document
      .getText(new Range(range.start.line, 0, range.start.line + newLines, 0))
      .slice(0, -1);

    // Remove old decorations in range
    const oldDecorations = this.lineDecorations.slice(
      range.start.line,
      range.end.line + 1
    );
    oldDecorations.forEach(({ decorationType }) => decorationType.dispose());

    const newDecorations = this.buildDecorations(changedLinesText);

    // Apply new decorations
    newDecorations.forEach(({ decorationType }, i) => {
      const l = i + range.start.line;
      window.activeTextEditor?.setDecorations(decorationType, [
        new Range(l, 0, l, 0),
      ]);
    });

    // Splice new decorations into list
    this.lineDecorations.splice(
      range.start.line,
      sourceLineCount,
      ...newDecorations
    );
  }
}
