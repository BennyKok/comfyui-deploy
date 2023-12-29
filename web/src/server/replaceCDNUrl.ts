export function replaceCDNUrl(url: string) {
  // When using R2, we don't want to include the bucket name in the URL
  if (process.env.SPACES_CDN_DONT_INCLUDE_BUCKET === "true") {
    url = url.replace(
      `${process.env.SPACES_ENDPOINT}/${process.env.SPACES_BUCKET}`,
      process.env.SPACES_ENDPOINT_CDN!
    );
    // When using digital ocean, we need to use the bucket name in the URL
  } else if (process.env.SPACES_CDN_FORCE_PATH_STYLE === "false") {
    const cdnUrl = new URL(process.env.SPACES_ENDPOINT_CDN!);
    url = url.replace(
      `${process.env.SPACES_ENDPOINT}/${process.env.SPACES_BUCKET}`,
      `${cdnUrl.protocol}//${process.env.SPACES_BUCKET}.${cdnUrl.host}`
    );
  } else {
    url = url.replace(
      process.env.SPACES_ENDPOINT!,
      process.env.SPACES_ENDPOINT_CDN!
    );
  }
  return url;
}
