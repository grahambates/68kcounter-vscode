import {
  Disposable,
  Range,
  TextDocumentChangeEvent,
  TextEditor,
  TextEditorDecorationType,
  ThemeColor,
  window,
  workspace,
} from "vscode";
import parse, { formatTiming, Level, timingLevel } from "68kcounter";

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
  private editor: TextEditor;
  private decorations: TextEditorDecorationType[] | null = null;
  private disposable: Disposable;

  constructor(editor: TextEditor) {
    this.editor = editor;
    this.show();
    this.disposable = Disposable.from(
      workspace.onDidChangeTextDocument(this.onTextDocumentChanged, this)
    );
  }

  dispose(): void {
    this.hide();
    this.disposable.dispose();
  }

  toggle(): void {
    this.decorations ? this.hide() : this.show();
  }

  show(): void {
    this.decorations = this.buildDecorations(this.editor.document.getText());
    this.decorations?.forEach((decorationType, i) => {
      this.editor.setDecorations(decorationType, [new Range(i, 0, i, 0)]);
    });
  }

  hide(): void {
    if (this.decorations) {
      this.decorations.forEach((d) => d.dispose());
    }
    this.decorations = null;
  }

  /**
   * Build an array containing decorations for each line of code
   *
   * @param text Source code lines
   * @returns Decorations
   */
  private buildDecorations(text: string) {
    return parse(text).map(({ words, timings }) => {
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
      return window.createTextEditorDecorationType({
        before: {
          contentText,
          color,
          width,
        },
      });
    });
  }

  private onTextDocumentChanged(e: TextDocumentChangeEvent) {
    if (this.decorations && e.document === this.editor.document) {
      // console.log("Received " + e.contentChanges.length + " content changes");

      e.contentChanges.forEach((change) => {
        if (!this.decorations) {
          return;
        }
        // console.log(change);

        const { range, text } = change;
        const sourceLineCount = range.end.line - range.start.line + 1;
        const newLines = text.split("\n").length;
        const changedLinesText = e.document
          .getText(
            new Range(range.start.line, 0, range.start.line + newLines, 0)
          )
          .slice(0, -1);

        // console.log(
        //   `Replaced ${sourceLineCount} line(s) starting at line ${range.start.line} with ${newLines} line of new text`
        // );

        // console.log(
        //   `Removing old decorations on lines ${range.start.line}-${range.end.line}`
        // );

        // Remove old decorations in range
        const oldDecorations = this.decorations.slice(
          range.start.line,
          range.end.line + 1
        );
        oldDecorations.forEach((d) => d.dispose());

        const newDecorations = this.buildDecorations(changedLinesText);

        // console.log(
        //   `Adding ${newDecorations.length} new decorations starting at line ${range.start.line}`
        // );

        // Apply new decorations
        newDecorations.forEach((decorationType, i) => {
          const l = i + range.start.line;
          this.editor.setDecorations(decorationType, [new Range(l, 0, l, 0)]);
        });

        // console.log(
        //   `Splicing ${newDecorations.length} new decorations at line ${range.start.line}, replacing ${sourceLineCount} existing`
        // );

        // Splice new decorations into list
        this.decorations.splice(
          range.start.line,
          sourceLineCount,
          ...newDecorations
        );
      });
    }
  }
}
