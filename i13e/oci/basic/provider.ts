import { ConfigFileAuthenticationDetailsProvider } from "oci-sdk"
import * as path from "path"
import * as fs from "fs"
import * as os from "os"

export function getProvider(profile: string) {
    const configurationFilePath = getConfigurationFilePath();

    return new ConfigFileAuthenticationDetailsProvider(
        configurationFilePath,
        profile
    )
}

function getConfigurationFilePath(): string {
    // First, try local ./oci folder
    const localConfigPath = path.join(".", ".oci", "config");
    if (fs.existsSync(localConfigPath)) {
        return localConfigPath;
    }

    // If not found, use home folder
    const homeConfigPath = path.join(os.homedir(), ".oci", "config");
    return homeConfigPath;
}