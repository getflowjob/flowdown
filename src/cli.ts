import { program } from "commander";
import { getFolder, Folder } from "./folder";
import fs from "fs";
import { exportDoc } from "./docs";
import { exportFile } from "./file";


program
    .name('flowdown')
    .description('Use Google Drive as your CMS')

let folderId = "";    

program
    .argument('<id>', 'id of the root folder')
    .action((id) => folderId = id)
    .option("-f --folder <string>", "limit the export to a specific folder")
    .option("-d --dir <string>", "specify the name of the local export directory", "flowdown")
    .parse();

const options = program.opts();

console.log("Processing root folder", folderId);
try {
    const root = await getFolder(folderId, options.dir);
    await process(root);   
}
catch (e) {
    console.error("Error processing root folder", folderId, e.message);
}

async function process(folder: Folder) {
    // Process this folder
    fs.mkdirSync(folder.path, { recursive: true });
    // Export any docs
    for (const id of folder.docs) {
        await exportDoc(id, folder.path);
    }
    for (const id of folder.files) {
        await exportFile(id, folder.path);
    }
    // Process any children
    if (folder.folders) {
        folder.folders.forEach((f) => process(f));
    }
}

