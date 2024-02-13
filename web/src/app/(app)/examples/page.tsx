import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";

export default function Page() {
  return <Examples />;
}


type exampleWorkflow = {
  title: string;
  description: string;
  previewURL: string;
  image: {
    src: string,
    alt: string,
  };
};

const exampleWorkflows: exampleWorkflow[] = [
  {
    title: "Txt2Img SDXL",
    description: "The basic workflow, type a prompt and generate images based on that.",
    previewURL: 'https://www.comfydeploy.com/share/comfy-deploy-example-txt2img-sdxl',
    image: {
      src: '/example-workflows/txt2img.webp',
      alt: 'IPAdapter workflow',
    }
  },
  {
    title: "Txt2Img LCM SDXL",
    description: "Images in a couple of seconds, increase the speed of each generation using LCM Lora.",
    previewURL: 'https://www.comfydeploy.com/share/comfy-deploy-example-lcm-sdxl',
    image: {
      src: '/example-workflows/txt2img-lcm.webp',
      alt: 'txt2img LCM SDXL',
    }
  },
  {
    title: "IPAdapter SDXL",
    description: "Load images and use them as reference for new generations.",
    previewURL: 'https://www.comfydeploy.com/share/comfy-deploy-example-ip-adapter-sdxl',
    image: {
      src: '/example-workflows/ipadapter.webp',
      alt: 'IPAdapter workflow',
    }
  },
  {
    title: "Upscale and Add Detail SDXL",
    description: "Upscale and Add Details to your creations.",
    previewURL: 'https://www.comfydeploy.com/share/comfy-deploy-example-upscale-and-add-detail-sdxl',
    image: {
      src: '/example-workflows/upscale.webp',
      alt: 'Upscale and Add Detail SDXL',
    }
  },
  {
    title: "Txt2Img SDXL Turbo",
    description: "Try SDXL turbo and generate images since 1 step in seconds.",
    previewURL: 'https://www.comfydeploy.com/share/comfy-deploy-example-txt2img-sdxl-turbo',
    image: {
      src: '/example-workflows/txt2img-sdxl-turbo.webp',
      alt: 'Txt2Img SDXL Turbo',
    }
  },
  {
    title: "Img2Img SDXL Controlnet",
    description: "This workflow uses canny. Generate lines of you original image and create variations.",
    previewURL: 'https://www.comfydeploy.com/share/comfy-deploy-example-img2-img-sdxl-controlnet',
    image: {
      src: '/example-workflows/txt2img-controlnet.webp',
      alt: 'Img2Img SDXL Controlnet',
    }
  },
  {
    title: "Automatic Inpainting (SEG)",
    description: "Type what do you want to select and change that area with your prompt.",
    previewURL: 'https://www.comfydeploy.com/share/comfy-deploy-example-automatic-inpainting-clip-seg',
    image: {
      src: '/example-workflows/automatic-inpainting-seg.webp',
      alt: 'Img2Img SDXL Controlnet',
    }
  }
];


async function Examples() {
  return (
    <div className="w-full py-4">
      <section className="mx-auto flex max-w-[980px] flex-col items-center gap-2 py-8 md:py-12 md:pb-8 lg:py-24 lg:pb-20">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl text-center">
          Check out some examples
        </h1>
        <p className="max-w-[560px] text-center text-lg text-muted-foreground">Text to Image, Image to Image, IPAdapter, and more. Here are some examples that you can use to deploy your workflow.</p>
      </section>
      <section className="flex justify-center flex-wrap gap-5">
        {exampleWorkflows.map(workflow => {
          return <Card className="w-[350px]">
            <CardHeader>
              <CardTitle>{workflow.title}</CardTitle>
              <CardDescription>{workflow.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Image src={workflow.image.src} alt={workflow.image.alt} width={350} height={230} />
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button asChild>
                <Link href={workflow.previewURL}>View Workflow</Link>
              </Button>
            </CardFooter>
          </Card>;
        })}
      </section>
    </div>
  );
}
