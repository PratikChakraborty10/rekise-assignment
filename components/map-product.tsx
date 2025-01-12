"use client";

import React, { useEffect, useRef, useState } from "react";
import "ol/ol.css";
import { Map, View, Feature } from "ol";
import TileLayer from "ol/layer/Tile";
import XYZ from "ol/source/XYZ";
import { fromLonLat, transform } from "ol/proj";
import { Button } from "@/components/ui/button";
import {
  Pencil,
  X,
  MoreVertical,
  ArrowLeftToLine,
  ArrowRightToLine,
} from "lucide-react";
import { Draw } from "ol/interaction";
import { Vector as VectorLayer } from "ol/layer";
import { Vector as VectorSource } from "ol/source";
import { Style, Stroke, Fill } from "ol/style";
import { LineString, Polygon } from "ol/geom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  PolygonPoint,
  PolygonData,
  MapState,
} from "../types/types";
import {
  MAPTILER_API_KEY,
  calculateDistance,
  calculateArea,
  formatDistance,
  MAPTILER_BASE_URL,
  MAP_INITIAL_ZOOM_LEVEL,
  MAP_STARTING_COORDS,
} from "../utils";
import { useToast } from "@/hooks/use-toast"
import { useTheme } from "next-themes";

// Component
const MapProduct = () => {
  // Refs for managing OpenLayers instances
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<Map | null>(null);
  const drawRef = useRef<Draw | null>(null);
  const vectorLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const polygonLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const vectorSourceRef = useRef<VectorSource | null>(null);
  const polygonSourceRef = useRef<VectorSource | null>(null);

  // State Management
  const [mapState, setMapState] = useState<MapState>({
    isOpen: false,
    isDrawingStarted: false,
    isDrawingComplete: false,
    isDrawingPolygon: false,
    activeWaypoint: null,
  });
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [currentPolygonPoints, setCurrentPolygonPoints] = useState<
    PolygonPoint[]
  >([]);
  const [polygons, setPolygons] = useState<PolygonData[]>([]);

  // UI requirements
  const { toast } = useToast()
  const { theme } =  useTheme()

  // Table Definitions
  const polygonPointColumns: ColumnDef<PolygonPoint>[] = [
    {
      accessorKey: "id",
      header: "Point",
    },
    {
      accessorKey: "coordinates",
      header: "Coordinates",
    },
    {
      accessorKey: "distance",
      header: "Distance",
      cell: ({ row }) => formatDistance(row.getValue("distance")),
    },
  ];

  const waypointColumns: ColumnDef<Waypoint>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="translate-y-[2px]"
        />
      ),
    },
    {
      accessorKey: "id",
      header: "Waypoint",
    },
    {
      accessorKey: "coordinates",
      header: "Coordinates",
    },
    {
      accessorKey: "distance",
      header: "Distance",
      cell: ({ row }) => formatDistance(row.getValue("distance")),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <WaypointActions
          waypoint={row.original}
          onPolygonDrawStart={startPolygonDraw}
        />
      ),
    },
  ];

  // Tables
  const polygonPointsTable = useReactTable({
    data: currentPolygonPoints,
    columns: polygonPointColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const waypointTable = useReactTable({
    data: waypoints,
    columns: waypointColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  // Processes the points after a polygon is drawn, converting coordinates and calculating distances
  const handlePolygonPointAdd = (event: any) => {
    const feature = event.feature as Feature<Polygon>;
    const geometry = feature.getGeometry();
    if (!geometry) return;

    const coordinates = geometry.getCoordinates()[0];
    const transformedCoords = coordinates.map((coord) =>
      transform(coord, "EPSG:3857", "EPSG:4326")
    ) as [number, number][];

    const points = transformedCoords.map((coord, index) => {
      const [lon, lat] = coord;
      const roundedLon = Number(lon.toFixed(6));
      const roundedLat = Number(lat.toFixed(6));

      const distance =
        index > 0
          ? calculateDistance(transformedCoords[index - 1], [
              roundedLon,
              roundedLat,
            ])
          : null;

      return {
        id: index.toString().padStart(2, "0"),
        coordinates: `${roundedLon}, ${roundedLat}`,
        distance,
        rawCoords: [roundedLon, roundedLat],
      };
    });

    setCurrentPolygonPoints(points);
  };

  // Creates waypoints from drawn coordinates after a line drawing is completed
  const handleLineStringDrawEnd = (event: any) => {
    const feature = event.feature as Feature<LineString>;
    const geometry = feature.getGeometry();
    if (!geometry) return;

    const coordinates = geometry.getCoordinates();
    const transformedWaypoints = coordinates.map((coord, index) => {
      const [lon, lat] = transform(coord, "EPSG:3857", "EPSG:4326");
      const roundedLon = Number(lon.toFixed(6));
      const roundedLat = Number(lat.toFixed(6));

      const distance =
        index > 0
          ? calculateDistance(
              transform(coordinates[index - 1], "EPSG:3857", "EPSG:4326") as [
                number,
                number
              ],
              [roundedLon, roundedLat]
            )
          : null;

      return {
        id: index.toString().padStart(2, "0"),
        coordinates: `${roundedLon}, ${roundedLat}`,
        distance,
        rawCoords: [roundedLon, roundedLat],
      };
    });

    setWaypoints(transformedWaypoints);
  };

  // Initiates polygon drawing mode relative to a specific waypoint
  const startPolygonDraw = (
    waypointId: string,
    position: "before" | "after"
  ) => {
    if (!mapInstance.current) return;

    setMapState((prev) => ({
      ...prev,
      isDrawingPolygon: true,
      activeWaypoint: { id: waypointId, position },
    }));
    setCurrentPolygonPoints([]);

    initializePolygonLayer();
    initializePolygonDrawing();
  };

  // Saves the current polygon points and adds them to the polygons collection
  const handleImportPoints = () => {
    if (!mapState.activeWaypoint || !currentPolygonPoints.length) return;

    const newPolygon: PolygonData = {
      id: `polygon-${polygons.length + 1}`,
      points: currentPolygonPoints,
      area: calculateArea(currentPolygonPoints.map((p) => p.rawCoords)),
      relatedWaypointId: mapState.activeWaypoint.id,
      position: mapState.activeWaypoint.position,
    };

    console.log("polygon data", newPolygon);
    toast({
      title: "Polygon Data",
      description: JSON.stringify(newPolygon),
    })

    setPolygons((prev) => [...prev, newPolygon]);
    // resetPolygonDrawing()
  };

  // Cancels the current polygon drawing and restores line drawing mode
  const handleDiscard = () => {
    resetPolygonDrawing();
    restoreLineStringDrawing();
  };

  // Initialization functions - Creates and configures the initial map instance with MapTiler base layer
  const initializeMap = () => {
    if (!mapRef.current) return;

    const maptilerUrl = `${MAPTILER_BASE_URL}/streets-v2/256/{z}/{x}/{y}.png?key=${MAPTILER_API_KEY}`;

    mapInstance.current = new Map({
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
        center: fromLonLat(MAP_STARTING_COORDS),
        zoom: MAP_INITIAL_ZOOM_LEVEL,
      }),
    });
  };

  // Sets up the drawing tools and layer for creating route lines
  const initializeLineStringDrawing = () => {
    if (!mapInstance.current) return;

    if (!vectorSourceRef.current) {
      vectorSourceRef.current = new VectorSource();
      vectorLayerRef.current = new VectorLayer({
        source: vectorSourceRef.current,
        style: new Style({
          stroke: new Stroke({
            color: "blue",
            width: 4,
          }),
        }),
      });
      mapInstance.current.addLayer(vectorLayerRef.current);
    }

    drawRef.current = new Draw({
      source: vectorSourceRef.current,
      type: "LineString",
    });

    drawRef.current.on("drawend", handleLineStringDrawEnd);
    mapInstance.current.addInteraction(drawRef.current);

    setMapState((prev) => ({
      ...prev,
      isDrawingStarted: true,
      isDrawingComplete: false,
    }));
  };

  // Creates and configures the vector layer for polygon features
  const initializePolygonLayer = () => {
    if (!mapInstance.current || polygonSourceRef.current) return;

    polygonSourceRef.current = new VectorSource();
    polygonLayerRef.current = new VectorLayer({
      source: polygonSourceRef.current,
      style: new Style({
        stroke: new Stroke({
          color: "rgba(100, 100, 255, 1)",
          width: 2,
        }),
        fill: new Fill({
          color: "rgba(100, 100, 255, 0.3)",
        }),
      }),
    });
    mapInstance.current.addLayer(polygonLayerRef.current);
  };

  // Sets up the drawing interaction specifically for creating polygons
  const initializePolygonDrawing = () => {
    if (!mapInstance.current || !polygonSourceRef.current) return;

    if (drawRef.current) {
      mapInstance.current.removeInteraction(drawRef.current);
    }

    drawRef.current = new Draw({
      source: polygonSourceRef.current,
      type: "Polygon",
    });

    drawRef.current.on("drawend", handlePolygonPointAdd);
    mapInstance.current.addInteraction(drawRef.current);
  };

  // Reset - Cleans up the current polygon drawing state and removes related interactions
  const resetPolygonDrawing = () => {
    setMapState((prev) => ({
      ...prev,
      isDrawingPolygon: false,
      activeWaypoint: null,
    }));
    setCurrentPolygonPoints([]);

    if (polygonSourceRef.current) {
      polygonSourceRef.current.clear();
    }

    if (drawRef.current && mapInstance.current) {
      mapInstance.current.removeInteraction(drawRef.current);
    }
  };

  // Reactivates the line drawing functionality after polygon operations
  const restoreLineStringDrawing = () => {
    if (!mapInstance.current || !vectorSourceRef.current) return;

    drawRef.current = new Draw({
      source: vectorSourceRef.current,
      type: "LineString",
    });

    drawRef.current.on("drawend", handleLineStringDrawEnd);
    mapInstance.current.addInteraction(drawRef.current);
  };

  // On Load
  useEffect(() => {
    initializeMap();
    return () => {
      if (mapInstance.current) {
        mapInstance.current.setTarget(null);
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        if (mapState.isDrawingPolygon && drawRef.current) {
          drawRef.current.finishDrawing();
        } else if (
          mapState.isDrawingStarted &&
          !mapState.isDrawingComplete &&
          drawRef.current &&
          mapInstance.current
        ) {
          mapInstance.current.removeInteraction(drawRef.current);
          drawRef.current = null;
          setMapState((prev) => ({ ...prev, isDrawingComplete: true }));
        }
      }
    };

    if (mapState.isDrawingStarted || mapState.isDrawingPolygon) {
      window.addEventListener("keydown", handleKeyPress);
      if (drawRef.current) {
        if (mapState.isDrawingPolygon) {
          drawRef.current.on("drawend", handlePolygonPointAdd);
        } else {
          drawRef.current.on("drawend", handleLineStringDrawEnd);
        }
      }
    }

    return () => {
      window.removeEventListener("keydown", handleKeyPress);
      if (drawRef.current) {
        drawRef.current.un("drawend", handlePolygonPointAdd);
        drawRef.current.un("drawend", handleLineStringDrawEnd);
      }
    };
  }, [
    mapState.isDrawingStarted,
    mapState.isDrawingComplete,
    mapState.isDrawingPolygon,
  ]);

  // Renders dropdown menu for waypoint-specific polygon actions
  const WaypointActions = ({
    waypoint,
    onPolygonDrawStart,
  }: {
    waypoint: Waypoint;
    onPolygonDrawStart: (id: string, position: "before" | "after") => void;
  }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => onPolygonDrawStart(waypoint.id, "before")}
        >
          <ArrowLeftToLine className="mr-2" />
          Insert polygon before
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onPolygonDrawStart(waypoint.id, "after")}
        >
          <ArrowRightToLine className="mr-2" />
          Insert polygon after
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Table component for displaying waypoint and polygon data
  const DataTable = ({
    table,
    columns,
  }: {
    table: any;
    columns: ColumnDef<any>[];
  }) => (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup: any) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header: any) => (
              <TableHead key={header.id}>
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows?.length ? (
          table.getRowModel().rows.map((row: any) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() && "selected"}
            >
              {row.getVisibleCells().map((cell: any) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={columns.length} className="h-24 text-center">
              No results.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  // Main dialog component for map drawing interface and controls
  const DrawingDialog = () => (
    <div className="absolute top-2 left-10 w-1/2 bg-white dark:bg-black rounded-xl shadow-lg z-10">
      <div className="p-4 bg-gray-100 dark:bg-gray-950 shadow-lg rounded-t-xl flex justify-between items-center">
        <p className="font-bold text-md">
          {mapState.isDrawingPolygon ? "Polygon Tool" : "Mission Creation"}
        </p>
        <X
          className="hover:cursor-pointer"
          onClick={() => setMapState((prev) => ({ ...prev, isOpen: false }))}
        />
      </div>
      <div className="max-h-[400px] overflow-y-auto w-full p-4">
        {!mapState.isDrawingStarted ? (
          <InitialInstructions />
        ) : (
          <DrawingContent />
        )}
      </div>
      <DialogActions />
    </div>
  );

  // Displays initial instructions for route creation
  const InitialInstructions = () => (
    <div className="flex flex-col gap-2">
      <p className="font-bold text-sm">Waypoint Navigation</p>
      <div className="p-4 border-[1px] border-gray-700 dark:border-gray-200 border-dashed rounded-lg bg-gray-200 dark:bg-gray-700">
        <p className="text-sm">
          Click on Generate Data to start drawing the route. Then click on the
          map to mark points and double click on the point in the map / press ↵
          to complete the route.
        </p>
      </div>
    </div>
  );

  // Renders appropriate content based on current drawing mode
  const DrawingContent = () => (
    <div className="flex flex-col gap-4">
      {mapState.isDrawingPolygon ? (
        <PolygonDrawingContent />
      ) : (
        <WaypointContent />
      )}
    </div>
  );

  // Displays polygon drawing interface and points table
  const PolygonDrawingContent = () => (
    <div className="space-y-4">
      <div className="p-4 border-[1px] border-gray-700 dark:border-gray-200 border-dashed rounded-lg bg-gray-200 dark:bg-gray-700">
        <p className="text-sm">
          Drawing polygon {mapState.activeWaypoint?.position} waypoint{" "}
          {mapState.activeWaypoint?.id}. Click to add points and press ↵ to
          complete.
        </p>
      </div>
      <div className="rounded-md border bg-white dark:bg-black">
        <p className="p-2 font-semibold">Polygon Points</p>
        <DataTable table={polygonPointsTable} columns={polygonPointColumns} />
      </div>
    </div>
  );

  // Displays waypoint table and related controls
  const WaypointContent = () => (
    <div className="rounded-md border bg-white dark:bg-black">
      <p className="p-2 font-semibold">Waypoints</p>
      <DataTable table={waypointTable} columns={waypointColumns} />
    </div>
  );

  // Renders action buttons based on current drawing state
  const DialogActions = () => (
    <div className="border-t-[1px] border-gray-300 p-4 flex justify-end gap-2">
      {mapState.isDrawingPolygon && currentPolygonPoints.length > 0 ? (
        <>
          <Button
            variant="outline"
            className="font-bold"
            onClick={handleDiscard}
          >
            Discard
          </Button>
          <Button className="font-bold" onClick={handleImportPoints}>
            Import Points
          </Button>
        </>
      ) : (
        <Button
          className="font-bold"
          onClick={
            mapState.isDrawingComplete
              ? initializeLineStringDrawing
              : initializeLineStringDrawing
          }
          disabled={mapState.isDrawingPolygon}
        >
          {mapState.isDrawingComplete ? "Start New Route" : "Generate Data"}
        </Button>
      )}
    </div>
  );

  // Main render component
  return (
    <div className="h-full w-full bg-blue-200">
      <div ref={mapRef} className="h-full w-full relative">
        <Button
          className="absolute top-4 right-4 z-10 font-bold flex items-center gap-4"
          onClick={() => setMapState((prev) => ({ ...prev, isOpen: true }))}
        >
          Draw on map
          <Pencil className="h-4 w-4" />
        </Button>

        {mapState.isOpen && <DrawingDialog />}
      </div>
    </div>
  );
};

export default MapProduct;
