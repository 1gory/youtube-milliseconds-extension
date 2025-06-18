# Permission Justification for YouTube Milliseconds Timer

## activeTab Permission
**Purpose**: Access the current YouTube tab to modify video player time display elements.
**Usage**: The extension needs to read video element properties (currentTime, duration) and update DOM elements that show timestamps.
**User Benefit**: Enables millisecond precision time display on YouTube videos.

## Host Permissions (youtube.com)
**Purpose**: Run content scripts specifically on YouTube domains to enhance video player functionality.
**Usage**: Inject JavaScript and CSS to modify time display format and update timestamps in real-time.
**User Benefit**: Provides enhanced timing precision for better video control and analysis.

## Remote Code Usage
This extension does not use any remote code. All functionality is contained within the extension package.
