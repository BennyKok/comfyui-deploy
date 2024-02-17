type imagesType = {
  url: string;
  width?: number;
  height?: number;
};
type VisualizeImagesGridProps = {
  images: imagesType[];
  layout?: 'justify-between' | 'justify-center' | 'justify-start' | 'justify-end';
};
export function VisualizeImagesGrid({ images, layout }: VisualizeImagesGridProps) {

  return (
    <div className={`flex gap-4 flex-wrap ${layout || 'justify-center'}`}>
      <>
        {images && images.length > 0 &&
          images.map(item => {
            if (!item) {
              return;
            }
            if (item?.url.endsWith(".mp4") || item?.url.endsWith(".webm")) {
              return (
                <video key={item?.url} controls autoPlay className="rounded-xl" style={{ maxHeight: item.height || 370, maxWidth: item.width || "auto" }}>
                  <source src={item?.url} type="video/mp4" />
                  <source src={item?.url} type="video/webm" />
                  Your browser does not support the video tag.
                </video>
              );
            }
            return <img
              key={item?.url}
              className="object-contain overflow-hidden rounded-xl"
              src={item?.url}
              alt="Generated image"
              style={{ maxHeight: item.height || 370, maxWidth: item.width || "auto" }}
            />;
          })
        }
      </>
    </div>
  );

}