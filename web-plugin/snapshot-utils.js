// Snapshot Utilities
// Centralized snapshot fetching with ComfyUI version fallback

/**
 * Fetches the current snapshot with ComfyUI version fallback
 * If the snapshot response has null comfyui field, it will fetch the latest ComfyUI version
 * and update the snapshot with the comfyui_hash
 *
 * @param {Function} getDataFn - Function that returns { apiKey, apiUrl } for ComfyUI version API calls
 * @returns {Promise<Object>} - The snapshot data with comfyui field populated
 */
export async function fetchSnapshot(getDataFn = null) {
  try {
    // Fetch the current snapshot
    const response = await fetch("/snapshot/get_current");
    if (!response.ok) {
      throw new Error(`Snapshot fetch failed: ${response.status}`);
    }

    const snapshot = await response.json();

    // Check if comfyui field is null and we have getDataFn for fallback
    if (snapshot.comfyui === null && getDataFn) {
      console.log(
        "ComfyUI version is null in snapshot, fetching latest version..."
      );

      try {
        const data = getDataFn();
        if (data && data.apiKey) {
          const comfyuiVersionResponse = await fetch(
            `/comfyui-deploy/comfyui-version?api_url=${encodeURIComponent(
              data.apiUrl || "https://api.comfydeploy.com"
            )}`,
            {
              headers: {
                Authorization: `Bearer ${data.apiKey}`,
              },
            }
          );

          if (comfyuiVersionResponse.ok) {
            const versionData = await comfyuiVersionResponse.json();
            if (versionData.comfyui_hash) {
              console.log(
                `Using ComfyUI hash from API: ${versionData.comfyui_hash}`
              );
              snapshot.comfyui = versionData.comfyui_hash;
            }
          } else {
            console.warn(
              "Failed to fetch ComfyUI version from API:",
              comfyuiVersionResponse.status
            );
          }
        }
      } catch (error) {
        console.warn("Error fetching ComfyUI version fallback:", error);
        // Continue with original snapshot even if fallback fails
      }
    }

    return snapshot;
  } catch (error) {
    console.error("Error fetching snapshot:", error);
    throw error;
  }
}
