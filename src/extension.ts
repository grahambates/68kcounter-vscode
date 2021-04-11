import { commands, ExtensionContext, languages } from "vscode";
import AnnotateCodeLensProvider from "./AnnotateCodeLensProvider";
import AnnotateController from "./AnnotateController";

export function activate(context: ExtensionContext): void {
  const controller = new AnnotateController();
  context.subscriptions.push(controller);

  context.subscriptions.push(
    commands.registerCommand("68kcounter.toggleCounts", () =>
      controller.toggle()
    )
  );

  context.subscriptions.push(
    languages.registerCodeLensProvider("m68k", new AnnotateCodeLensProvider())
  );
}

export function deactivate(): void {
  //
}
