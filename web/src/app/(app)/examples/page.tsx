import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";

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
    title: "txt2img",
    description: "The basic workflow, type a prompt and generate images based on that.",
    previewURL: '',
    image: {
      src: '/example-workflows/IPAdapter.jpg',
      alt: 'IPAdapter workflow',
    }
  },
  {
    title: "IPAdapter [SDXL]",
    description: "Load images and use them as reference for new generations.",
    previewURL: '',
    image: {
      src: '/example-workflows/img2img.jpg',
      alt: 'IPAdapter workflow',
    }
  },
  {
    title: "img2img inpainting",
    description: "Use an image as base and modify certain areas that you select.",
    previewURL: '',
    image: {
      src: '/example-workflows/text2img.jpg',
      alt: 'img2img inpainting workflow',
    }
  }
];


async function Examples() {
  return (
    <div className="w-full py-4">
      <section className="mx-auto flex max-w-[980px] flex-col items-center gap-2 py-8 md:py-12 md:pb-8 lg:py-24 lg:pb-20">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
          Check out some examples
        </h1>
        <p className="max-w-[560px] text-center text-lg text-muted-foreground">Text to Image, Image to Image, IPAdapter, and more. Here are some examples that you can use to deploy your workflow.</p>
      </section>
      <section className="flex gap-4">
        {exampleWorkflows.map(workflow => {
          return <Card className="w-[350px]">
            <CardHeader>
              <CardTitle>{workflow.title}</CardTitle>
              <CardDescription>{workflow.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Image src={workflow.image.src} alt={workflow.image.alt} width={350} height={230} />
            </CardContent>
            <CardFooter className="flex justify-between gap-2">
              <Button variant="outline">View</Button>
              <Button>Deploy</Button>
            </CardFooter>
          </Card>;
        })}
      </section>
    </div>
  );
}
