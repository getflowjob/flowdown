// import credentials from "./token.json";
import { google, Auth, docs_v1 } from "googleapis";
import fs from "fs";
import util from "util";
import stream from "stream";

// const auth = google.auth.fromJSON(credentials) as Auth.OAuth2Client;
// const drive = google.drive({ version: 'v3', auth });
// const docs = google.docs({ version: 'v1', auth: auth });

interface DriveItem {
    id: string;
    path: string;
    name: string;
    mime: string;
    type: string;
}

// Recursively list all files under a folder id
async function list(auth: Auth.OAuth2Client, id: string, path: string = "", items: DriveItem[] = []) {
    console.log("Listing", id, path || "/");
    const drive = google.drive({ version: "v3", auth });

    let pageToken: string | undefined;
    do {
        const res = await drive.files.list({
            q: `'${id}' in parents and trashed = false`,
            pageToken,
            fields: "nextPageToken, files(id, name, mimeType, shortcutDetails)",
        });
        for (const file of res.data.files || []) {
            switch (type(file.mimeType)) {
                case "folder":
                    await list(auth, file.id!, path + "/" + file.name, items);
                    break;
                case "shortcut":
                    console.log("Following shortcut", file.shortcutDetails?.targetId);
                    const target = await drive.files.get({ fileId: file.shortcutDetails?.targetId });
                    items.push({
                        id: target.data.id!,
                        path,
                        name: sanatise(file.name!),
                        mime: target.data.mimeType!,
                        type: type(target.data.mimeType),
                    });
                    break;
                default:
                    items.push({
                        id: file.id!,
                        path,
                        name: sanatise(file.name!),
                        mime: file.mimeType!,
                        type: type(file.mimeType),
                    });
            }
        }
        pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);
    return items;
}

function sanatise(name: string) {
    return name.replace(/[^-\._a-zA-Z0-9]/g, "_");
}

function type(mime: string | null | undefined) {
    return mime?.startsWith("application/vnd.google-apps.") ? mime.substring(28) : "binary";
}

// type Doc = Pick<docs_v1.Schema$Document, "body" | "inlineObjects">

// Get the google docs document JSON
async function getDocument(auth: Auth.OAuth2Client, id: string): Promise<docs_v1.Schema$Document | undefined> {
    const docs = google.docs({ version: "v1", auth: auth });
    try {
        console.log("Fetching", id);
        const doc = await docs.documents.get({ documentId: id });
        return doc.data;
    } catch (e) {
        console.error("Unable to get document", id, e.code, e.message);
    }
    return undefined;
}

const pipeline = util.promisify(stream.pipeline);

async function downloadFile(auth: Auth.OAuth2Client, id: string, out: fs.WriteStream) {
    const drive = google.drive({ version: "v3", auth });
    const file = await drive.files.get({ fileId: id, alt: "media" });
    await pipeline(file.data as any, out);
}

export { list, getDocument, downloadFile };