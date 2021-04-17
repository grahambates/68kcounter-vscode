import { commands, ExtensionContext, languages } from "vscode";
import AnnotateCodeLensProvider from "./AnnotateCodeLensProvider";
import AnnotateController from "./AnnotateController";
import countSelection from "./countSelection";

export function activate(context: ExtensionContext): void {
  const controller = new AnnotateController();
  context.subscriptions.push(controller);

  context.subscriptions.push(
    commands.registerCommand("68kcounter.toggleCounts", () =>
      controller.toggle()
    )
  );

  context.subscriptions.push(
    commands.registerCommand("68kcounter.countSelection", () =>
      countSelection()
    )
  );

  const codeLensProvider = new AnnotateCodeLensProvider();

  context.subscriptions.push(
    languages.registerCodeLensProvider("m68k", codeLensProvider)
  );
  context.subscriptions.push(
    languages.registerCodeLensProvider(
      "amiga-assembly-debug.disassembly",
      codeLensProvider
    )
  );
  context.subscriptions.push(
    languages.registerCodeLensProvider("as", codeLensProvider)
  );
  context.subscriptions.push(
    languages.registerCodeLensProvider("vasmmot", codeLensProvider)
  );
  context.subscriptions.push(
    languages.registerCodeLensProvider("vasmstd", codeLensProvider)
  );
  context.subscriptions.push(
    languages.registerCodeLensProvider("codewarrior", codeLensProvider)
  );
  context.subscriptions.push(
    languages.registerCodeLensProvider("amiga.assembly", codeLensProvider)
  );
  context.subscriptions.push(
    languages.registerCodeLensProvider("amiga.disassembly", codeLensProvider)
  );
  context.subscriptions.push(
    languages.registerCodeLensProvider(
      { pattern: "**/*.{s,i,asm}" },
      codeLensProvider
    )
  );
}

export function deactivate(): void {
  //
}
