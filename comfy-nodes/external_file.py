import folder_paths


class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False


WILDCARD = AnyType("*")


class ComfyUIDeployExternalFile:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "input_id": (
                    "STRING",
                    {"multiline": False, "default": "input_file"},
                ),
            },
            "optional": {
                "display_name": (
                    "STRING",
                    {"multiline": False, "default": ""},
                ),
                "description": (
                    "STRING",
                    {"multiline": True, "default": ""},
                ),
                "file_url": (
                    "STRING",
                    {"multiline": False, "default": ""},
                ),
            },
        }

    RETURN_TYPES = (WILDCARD,)
    RETURN_NAMES = ("path",)
    FUNCTION = "run"
    CATEGORY = "🔗ComfyDeploy"

    def run(
        self,
        input_id,
        display_name=None,
        description=None,
        file_url=None,
    ):
        import requests
        import os
        import uuid
        from urllib.parse import urlparse

        if file_url:
            if file_url.startswith("http"):
                # Use cache directory for saving files
                cache_dir = folder_paths.get_temp_directory()
                if not os.path.exists(cache_dir):
                    os.makedirs(cache_dir)

                # Always generate random filename to avoid conflicts
                parsed_url = urlparse(file_url)
                original_filename = os.path.basename(parsed_url.path)

                # Extract file extension from original filename if available
                file_extension = ""
                if original_filename and "." in original_filename:
                    file_extension = os.path.splitext(original_filename)[1]
                else:
                    # Try to determine extension from content-type if no extension found
                    file_extension = ".bin"

                # Generate random filename with preserved extension
                filename = str(uuid.uuid4()) + file_extension

                destination_path = os.path.join(cache_dir, filename)
                print(f"Cache directory: {cache_dir}")
                print(f"Destination path: {destination_path}")
                print(
                    "Downloading external file - "
                    + file_url
                    + " to "
                    + destination_path
                )

                headers = {"User-Agent": "Mozilla/5.0"}

                try:
                    response = requests.get(
                        file_url,
                        headers=headers,
                        allow_redirects=True,
                        timeout=30,  # Add timeout to prevent hanging
                    )
                    response.raise_for_status()

                    with open(destination_path, "wb") as out_file:
                        out_file.write(response.content)
                    print(f"External file downloaded: {file_url} to {destination_path}")
                    return (destination_path,)

                except requests.exceptions.HTTPError as e:
                    error_msg = f"HTTP Error {e.response.status_code}: {e.response.reason} for URL: {file_url}"
                    print(f"⚠️ Download failed - {error_msg}")
                    if e.response.status_code == 404:
                        print(
                            "💡 This URL might have expired or the file may have been deleted"
                        )
                    # Return empty string instead of crashing
                    return ("",)

                except requests.exceptions.RequestException as e:
                    error_msg = (
                        f"Network error downloading file from {file_url}: {str(e)}"
                    )
                    print(f"⚠️ Download failed - {error_msg}")
                    return ("",)

                except Exception as e:
                    error_msg = (
                        f"Unexpected error downloading file from {file_url}: {str(e)}"
                    )
                    print(f"⚠️ Download failed - {error_msg}")
                    return ("",)
            else:
                print(f"External file loading: {file_url}")
                return (file_url,)
        else:
            print(f"No file URL provided")
            return ("",)


NODE_CLASS_MAPPINGS = {"ComfyUIDeployExternalFile": ComfyUIDeployExternalFile}
NODE_DISPLAY_NAME_MAPPINGS = {
    "ComfyUIDeployExternalFile": "External File (ComfyUI Deploy)"
}
