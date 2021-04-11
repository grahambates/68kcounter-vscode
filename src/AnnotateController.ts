import { Disposable, TextDocument, window, workspace } from "vscode";
import { Annotator } from "./Annotator";

/**
 * Manages Annotator instances across the workspace
 */
export default class AnnotateController implements Disposable {
  private documentMap: Map<TextDocument, Annotator> = new Map();
  private subscription: Disposable;

  constructor() {
    this.subscription = workspace.onDidCloseTextDocument(
      this.onDidCloseTextDocument,
      this
    );
  }

  toggle(): void {
    const editor = window.activeTextEditor;
    if (!editor) {
      return;
    }
    const annotator = this.documentMap.get(editor.document);
    if (annotator) {
      annotator.toggle();
    } else {
      this.documentMap.set(editor.document, new Annotator(editor));
    }
  }

  dispose(): void {
    this.documentMap.forEach((a) => a.dispose());
    this.subscription.dispose();
  }

  private onDidCloseTextDocument(doc: TextDocument) {
    const annotator = this.documentMap.get(doc);
    if (annotator) {
      this.documentMap.delete(doc);
      annotator.dispose();
    }
  }
}
