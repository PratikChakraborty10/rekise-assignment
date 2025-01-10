"use client";

import React, { useEffect, useRef, useState } from "react";
import "ol/ol.css";
import { Map, View } from "ol";
import TileLayer from "ol/layer/Tile";
import XYZ from "ol/source/XYZ";
import { fromLonLat } from "ol/proj";
import { Button } from "./ui/button";
import { Pencil, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Label } from "./ui/label";
import { Input } from "./ui/input";

const MapProduct = () => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const startToDrawOnMap = (open: boolean) => {
    // Prevent dialog from closing on outside clicks
    window.alert("fsbvd")
    if (!open) return;
    setIsOpen(open);
  };

  useEffect(() => {
    if (!mapRef.current) return;

    // Replace 'your_maptiler_api_key' with your actual MapTiler API key
    const maptilerApiKey = "VqwpCTRfiFiP9uoi9Vkz";
    const maptilerUrl = `https://api.maptiler.com/maps/streets/256/{z}/{x}/{y}.png?key=${maptilerApiKey}`;

    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new XYZ({
            url: maptilerUrl,
            attributions:
              '© <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> © OpenStreetMap contributors',
          }),
        }),
      ],
      view: new View({
        center: fromLonLat([88.345714, 22.579661]), // Replace with desired longitude and latitude
        zoom: 16, // Adjust the zoom level
      }),
    });

    return () => {
      map.setTarget(null); // Cleanup the map when the component is unmounted
    };
  }, []);

  return (
    <div className="h-full w-full bg-blue-200">
      <div ref={mapRef} className="h-full w-full relative">
        {/* Draw Button */}
        <Button
          className="absolute top-4 right-4 z-10 font-bold flex items-center gap-4"
          onClick={() => setIsOpen(true)}
        >
          Draw on map
          <Pencil className="h-4 w-4" />
        </Button>

        {/* Custom Positioned Dialog */}
        <Dialog open={isOpen} modal={false}>
        <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Make changes to your profile here. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input id="name" value="Pedro Duarte" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="username" className="text-right">
              Username
            </Label>
            <Input id="username" value="@peduarte" className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit">Save changes</Button>
        </DialogFooter>
      </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default MapProduct;
