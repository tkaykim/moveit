"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import Autoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

interface Banner {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
}

interface BannerCarouselProps {
  banners: Banner[];
  autoSlideInterval?: number;
  isAutoSlideEnabled?: boolean;
  className?: string;
}

export function BannerCarousel({
  banners,
  autoSlideInterval = 5000,
  isAutoSlideEnabled = true,
  className,
}: BannerCarouselProps) {
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);
  const [count, setCount] = React.useState(0);

  const plugin = React.useRef(
    Autoplay({
      delay: autoSlideInterval,
      stopOnInteraction: true,
      stopOnMouseEnter: true,
    })
  );

  React.useEffect(() => {
    if (!api) {
      return;
    }

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1);
    });
  }, [api]);

  // autoSlideInterval이 변경되면 플러그인 업데이트
  React.useEffect(() => {
    if (plugin.current) {
      plugin.current.options.delay = autoSlideInterval;
    }
  }, [autoSlideInterval]);

  if (!banners || banners.length === 0) {
    return null;
  }

  return (
    <div className={cn("relative w-full", className)}>
      <Carousel
        setApi={setApi}
        plugins={isAutoSlideEnabled ? [plugin.current] : []}
        className="w-full"
        opts={{
          loop: true,
          align: "start",
        }}
      >
        <CarouselContent className="-ml-0">
          {banners.map((banner) => (
            <CarouselItem key={banner.id} className="pl-0">
              {banner.link_url ? (
                <Link href={banner.link_url} className="block">
                  <div className="relative aspect-[16/6] w-full overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-800">
                    <Image
                      src={banner.image_url}
                      alt={banner.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 800px"
                      className="object-cover transition-transform hover:scale-105"
                      priority={current === 1}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4">
                      <h3 className="text-white font-bold text-sm md:text-base drop-shadow-md truncate">
                        {banner.title}
                      </h3>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="relative aspect-[16/6] w-full overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-800">
                  <Image
                    src={banner.image_url}
                    alt={banner.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 800px"
                    className="object-cover"
                    priority={current === 1}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4">
                    <h3 className="text-white font-bold text-sm md:text-base drop-shadow-md truncate">
                      {banner.title}
                    </h3>
                  </div>
                </div>
              )}
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      
      {/* 인디케이터 */}
      {count > 1 && (
        <div className="absolute bottom-1 right-4 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1">
          <span className="text-white text-xs font-medium">{current}</span>
          <span className="text-white/60 text-xs">/</span>
          <span className="text-white/60 text-xs">{count}</span>
        </div>
      )}
    </div>
  );
}
