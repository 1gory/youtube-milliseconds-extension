Permission Justification for YouTube Milliseconds Timer

storage
Purpose: Save user preferences and watch time statistics locally on the device.
Usage: Stores the "show milliseconds" toggle setting and total YouTube watch time. No data leaves the device.
User Benefit: Settings persist between browser sessions; watch time accumulates over time.

clipboardWrite
Purpose: Copy the current video timestamp to the clipboard when the user clicks the copy button.
Usage: Called only in response to an explicit user click on the copy icon next to the timestamp. The extension never accesses the clipboard without user action.
User Benefit: Lets users instantly capture an exact timestamp (e.g. 1:23:45.678) for notes, sharing, or video editing.

Host Permissions (youtube.com)
Purpose: Run content scripts on YouTube to enhance the video player's time display.
Usage: Injects JavaScript and CSS to show millisecond-precision timestamps and add the copy button to the player controls.
User Benefit: Provides millisecond timing precision directly inside the YouTube player.

Remote Code
This extension does not use any remote code. All functionality is self-contained within the extension package.