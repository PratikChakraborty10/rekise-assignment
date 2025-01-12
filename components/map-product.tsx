"use client"

import React, { useEffect, useRef, useState } from "react"
import "ol/ol.css"
import { Map, View } from "ol"
import TileLayer from "ol/layer/Tile"
import XYZ from "ol/source/XYZ"
import { fromLonLat, transform } from "ol/proj"
import { Button } from "@/components/ui/button"
import { Pencil, X, MoreVertical, ArrowLeftToLine, ArrowRightToLine } from 'lucide-react'
import { Draw, Modify } from "ol/interaction"
import { Vector as VectorLayer } from "ol/layer"
import { Vector as VectorSource } from "ol/source"
import { Style, Stroke, Fill } from "ol/style"
import { Feature } from "ol"
import { LineString, Polygon, Point } from "ol/geom"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"

interface Waypoint {
  id: string
  coordinates: string
  distance: number | null
  rawCoords: [number, number]
}

interface PolygonPoint {
  id: string
  coordinates: string
  distance: number | null
  rawCoords: [number, number]
}

interface PolygonData {
  id: string
  points: PolygonPoint[]
  area: number
  relatedWaypointId: string
  position: 'before' | 'after'
}

const MapProduct = () => {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstance = useRef<Map | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isDrawingStarted, setIsDrawingStarted] = useState(false)
  const [isDrawingComplete, setIsDrawingComplete] = useState(false)
  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const [currentPolygonPoints, setCurrentPolygonPoints] = useState<PolygonPoint[]>([])
  const [polygons, setPolygons] = useState<PolygonData[]>([])
  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false)
  const [activeWaypoint, setActiveWaypoint] = useState<{ id: string, position: 'before' | 'after' } | null>(null)
  const drawRef = useRef<Draw | null>(null)
  const vectorLayerRef = useRef<VectorLayer<VectorSource> | null>(null)
  const polygonLayerRef = useRef<VectorLayer<VectorSource> | null>(null)
  const vectorSourceRef = useRef<VectorSource | null>(null)
  const polygonSourceRef = useRef<VectorSource | null>(null)

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
      cell: ({ row }) => {
        const distance = row.getValue("distance") as number | null
        if (distance === null) return "-"
        return distance >= 1000
          ? `${(distance / 1000).toFixed(2)} km`
          : `${Math.round(distance)} m`
      },
    },
  ]

  const polygonPointsTable = useReactTable({
    data: currentPolygonPoints,
    columns: polygonPointColumns,
    getCoreRowModel: getCoreRowModel(),
  })

  // Calculate area of polygon in square meters
  const calculateArea = (coords: [number, number][]): number => {
    let area = 0
    for (let i = 0; i < coords.length - 1; i++) {
      area += coords[i][0] * coords[i + 1][1] - coords[i + 1][0] * coords[i][1]
    }
    return Math.abs(area) / 2
  }

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
      enableSorting: false,
      enableHiding: false,
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
      cell: ({ row }) => {
        const distance = row.getValue("distance") as number | null
        if (distance === null) return "-"
        return distance >= 1000
          ? `${(distance / 1000).toFixed(2)} km`
          : `${Math.round(distance)} m`
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const waypoint = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => startPolygonDraw(waypoint.id, 'before')}
              >
                <ArrowLeftToLine className="mr-2" />
                Insert polygon before
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => startPolygonDraw(waypoint.id, 'after')}
              >
                <ArrowRightToLine className="mr-2" />
                Insert polygon after
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const waypointTable = useReactTable({
    data: waypoints,
    columns: waypointColumns,
    getCoreRowModel: getCoreRowModel(),
  })

  // Calculate distance between two points in meters
  const calculateDistance = (
    coord1: [number, number],
    coord2: [number, number]
  ): number => {
    const R = 6371000 // Earth's radius in meters
    const lat1 = (coord1[1] * Math.PI) / 180
    const lat2 = (coord2[1] * Math.PI) / 180
    const deltaLat = ((coord2[1] - coord1[1]) * Math.PI) / 180
    const deltaLon = ((coord2[0] - coord1[0]) * Math.PI) / 180

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLon / 2) *
        Math.sin(deltaLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }

  const handlePolygonPointAdd = (event: any) => {
    const feature = event.feature as Feature<Polygon>
    const geometry = feature.getGeometry()
    if (geometry) {
      const coordinates = geometry.getCoordinates()[0]
      const transformedCoords = coordinates.map(coord => 
        transform(coord, 'EPSG:3857', 'EPSG:4326')
      ) as [number, number][]

      const points = transformedCoords.map((coord, index) => {
        const [lon, lat] = coord
        const roundedLon = Number(lon.toFixed(6))
        const roundedLat = Number(lat.toFixed(6))

        let distance = null
        if (index > 0) {
          distance = calculateDistance(
            transformedCoords[index - 1],
            [roundedLon, roundedLat]
          )
        }

        return {
          id: index.toString().padStart(2, "0"),
          coordinates: `${roundedLon}, ${roundedLat}`,
          distance,
          rawCoords: [roundedLon, roundedLat] as [number, number],
        }
      })

      setCurrentPolygonPoints(points)
    }
  }

  const startPolygonDraw = (waypointId: string, position: 'before' | 'after') => {
    if (!mapInstance.current) return

    setActiveWaypoint({ id: waypointId, position })
    setIsDrawingPolygon(true)
    setCurrentPolygonPoints([])

    // Initialize polygon layer if not exists
    if (!polygonSourceRef.current) {
      polygonSourceRef.current = new VectorSource()
      polygonLayerRef.current = new VectorLayer({
        source: polygonSourceRef.current,
        style: new Style({
          stroke: new Stroke({
            color: 'rgba(100, 100, 255, 1)',
            width: 2,
          }),
          fill: new Fill({
            color: 'rgba(100, 100, 255, 0.3)',
          }),
        }),
      })
      mapInstance.current.addLayer(polygonLayerRef.current)
    }

    // Remove existing draw interaction if any
    if (drawRef.current) {
      mapInstance.current.removeInteraction(drawRef.current)
    }

    // Start polygon drawing
    drawRef.current = new Draw({
      source: polygonSourceRef.current,
      type: 'Polygon',
    })

    // Update points table on each point added
    drawRef.current.on('drawstart', () => {
      setCurrentPolygonPoints([])
    })

    drawRef.current.on('drawend', handlePolygonPointAdd)

    mapInstance.current.addInteraction(drawRef.current)
  }

  const handleImportPoints = () => {
    if (!activeWaypoint || !currentPolygonPoints.length) return

    const newPolygon: PolygonData = {
      id: `polygon-${polygons.length + 1}`,
      points: currentPolygonPoints,
      area: calculateArea(currentPolygonPoints.map(p => p.rawCoords)),
      relatedWaypointId: activeWaypoint.id,
      position: activeWaypoint.position,
    }

    console.log('Polygon Data:', newPolygon);
    setPolygons(prev => [...prev, newPolygon]);
    setIsDrawingPolygon(false);
    setActiveWaypoint(null);
    setCurrentPolygonPoints([]);
    if (polygonSourceRef.current) {
      polygonSourceRef.current.clear();
    }
    if (drawRef.current && mapInstance.current) {
      mapInstance.current.removeInteraction(drawRef.current);
    }
  }

  useEffect(() => {
    if (!mapRef.current) return

    const maptilerApiKey = "VqwpCTRfiFiP9uoi9Vkz"
    const maptilerUrl = `https://api.maptiler.com/maps/streets/256/{z}/{x}/{y}.png?key=${maptilerApiKey}`

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
        center: fromLonLat([88.345714, 22.579661]),
        zoom: 16,
      }),
    })

    return () => {
      if (mapInstance.current) {
        mapInstance.current.setTarget(null)
      }
    }
  }, [])

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        if (isDrawingPolygon && drawRef.current && mapInstance.current) {
          drawRef.current.finishDrawing()
        } else if (isDrawingStarted && !isDrawingComplete && drawRef.current && mapInstance.current) {
          mapInstance.current.removeInteraction(drawRef.current)
          drawRef.current = null
          setIsDrawingComplete(true)
        }
      }
    }

    const handleDrawEnd = (event: any) => {
      const feature = event.feature as Feature<LineString>
      const geometry = feature.getGeometry()
      if (geometry) {
        const coordinates = geometry.getCoordinates()
        const transformedWaypoints = coordinates.map((coord, index) => {
          const [lon, lat] = transform(coord, "EPSG:3857", "EPSG:4326")
          const roundedLon = Number(lon.toFixed(6))
          const roundedLat = Number(lat.toFixed(6))

          let distance = null
          if (index > 0) {
            const prevCoord = transform(
              coordinates[index - 1],
              "EPSG:3857",
              "EPSG:4326"
            )
            distance = calculateDistance(
              [Number(prevCoord[0].toFixed(6)), Number(prevCoord[1].toFixed(6))],
              [roundedLon, roundedLat]
            )
          }

          return {
            id: index.toString().padStart(2, "0"),
            coordinates: `${roundedLon}, ${roundedLat}`,
            distance,
            rawCoords: [roundedLon, roundedLat] as [number, number],
          }
        })
        setWaypoints(transformedWaypoints)
      }
    }

    if (isDrawingStarted || isDrawingPolygon) {
      window.addEventListener("keydown", handleKeyPress)
      if (drawRef.current) {
        drawRef.current.on("drawend", handleDrawEnd)
      }
    }

    return () => {
      window.removeEventListener("keydown", handleKeyPress)
      if (drawRef.current) {
        drawRef.current.un("drawend", handleDrawEnd)
      }
    }
  }, [isDrawingStarted, isDrawingComplete, isDrawingPolygon])

  const initializeDrawing = () => {
    if (!mapInstance.current) return

    setIsDrawingComplete(false)
    setWaypoints([])

    if (!vectorSourceRef.current) {
      vectorSourceRef.current = new VectorSource()
      vectorLayerRef.current = new VectorLayer({
        source: vectorSourceRef.current,
        style: new Style({
          stroke: new Stroke({
            color: "blue",
            width: 4,
          }),
        }),
      })

      mapInstance.current.addLayer(vectorLayerRef.current)
    } else {
      vectorSourceRef.current.clear()
    }

    drawRef.current = new Draw({
      source: vectorSourceRef.current,
      type: "LineString",
    })

    mapInstance.current.addInteraction(drawRef.current)
    setIsDrawingStarted(true)
  }

  const startNewDrawing = () => {
    if (drawRef.current && mapInstance.current) {
      mapInstance.current.removeInteraction(drawRef.current)
    }
    initializeDrawing()
  }

  const handleCloseDialog = () => {
    if (drawRef.current && mapInstance.current) {
      mapInstance.current.removeInteraction(drawRef.current)
    }
    if (vectorLayerRef.current && mapInstance.current) {
      mapInstance.current.removeLayer(vectorLayerRef.current)
    }
    if (polygonLayerRef.current && mapInstance.current) {
      mapInstance.current.removeLayer(polygonLayerRef.current)
    }
    vectorSourceRef.current = null
    vectorLayerRef.current = null
    polygonSourceRef.current = null
    polygonLayerRef.current = null
    drawRef.current = null
    setIsDrawingStarted(false)
    setIsDrawingComplete(false)
    setWaypoints([])
    setPolygons([])
    setCurrentPolygonPoints([])
    setIsOpen(false)
  }

  return (
    <div className="h-full w-full bg-blue-200">
      <div ref={mapRef} className="h-full w-full relative">
        <Button
          className="absolute top-4 right-4 z-10 font-bold flex items-center gap-4"
          onClick={() => setIsOpen(true)}
        >
          Draw on map
          <Pencil className="h-4 w-4" />
        </Button>

        {isOpen && (
          <div className="absolute top-2 left-10 w-1/2 bg-white dark:bg-black rounded-xl shadow-lg z-10">
            <div className="p-4 bg-gray-100 dark:bg-gray-950 shadow-lg rounded-t-xl flex justify-between items-center">
              <p className="font-bold text-md">
                {isDrawingPolygon ? 'Drawing Polygon' : 'Mission Creation'}
              </p>
              <X className="hover:cursor-pointer" onClick={handleCloseDialog} />
            </div>
            <div className="max-h-[400px] overflow-y-auto w-full p-4">
              {!isDrawingStarted ? (
                <div className="flex flex-col gap-2">
                  <p className="font-bold text-sm">Waypoint Navigation</p>
                  <div className="p-4 border-[1px] border-gray-700 border-dashed rounded-lg bg-gray-200">
                    <p className="text-xs text-gray-700">
                      Click on Generate Data to start drawing the route. Then click
                      on the map to mark points and press ↵ to complete the route.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {isDrawingPolygon ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-100 dark:bg-blue-950 rounded-lg">
                        <p className="text-sm">
                          Drawing polygon {activeWaypoint?.position} waypoint {activeWaypoint?.id}.
                          Click to add points and press Enter to complete.
                        </p>
                      </div>

                      <div className="rounded-md border bg-white dark:bg-black">
                        <p className="p-2 font-semibold">Polygon Points</p>
                        <Table>
                          <TableHeader>
                            {polygonPointsTable.getHeaderGroups().map((headerGroup) => (
                              <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
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
                            {polygonPointsTable.getRowModel().rows?.length ? (
                              polygonPointsTable.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                  {row.getVisibleCells().map((cell) => (
                                    <TableCell key={cell.id}>
                                      {flexRender(
                                        cell.column.columnDef.cell,
                                        cell.getContext()
                                      )}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell
                                  colSpan={polygonPointColumns.length}
                                  className="h-24 text-center"
                                >
                                  No points yet.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-md border bg-white dark:bg-black">
                      <p className="p-2 font-semibold">Waypoints</p>
                      <Table>
                        <TableHeader>
                          {waypointTable.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                              {headerGroup.headers.map((header) => (
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
                          {waypointTable.getRowModel().rows?.length ? (
                            waypointTable.getRowModel().rows.map((row) => (
                              <TableRow
                                key={row.id}
                                data-state={row.getIsSelected() && "selected"}
                              >
                                {row.getVisibleCells().map((cell) => (
                                  <TableCell key={cell.id}>
                                    {flexRender(
                                      cell.column.columnDef.cell,
                                      cell.getContext()
                                    )}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell
                                colSpan={waypointColumns.length}
                                className="h-24 text-center"
                              >
                                No results.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="border-t-[1px] border-gray-300 p-4 flex justify-end gap-2">
              {isDrawingPolygon && currentPolygonPoints.length > 0 ? (
                <>
                  <Button
                    variant="outline"
                    className="font-bold"
                    onClick={() => {
                      setIsDrawingPolygon(false);
                      setActiveWaypoint(null);
                      setCurrentPolygonPoints([]);
                      if (polygonSourceRef.current) {
                        polygonSourceRef.current.clear();
                      }
                      if (drawRef.current && mapInstance.current) {
                        mapInstance.current.removeInteraction(drawRef.current);
                      }
                      // Reset the draw interaction to the line string drawing state
                      if (vectorSourceRef.current && mapInstance.current) {
                        drawRef.current = new Draw({
                          source: vectorSourceRef.current,
                          type: "LineString",
                        });
                        mapInstance.current.addInteraction(drawRef.current);
                      }
                    }}
                  >
                    Discard
                  </Button>
                  <Button
                    className="font-bold"
                    onClick={handleImportPoints}
                  >
                    Import Points
                  </Button>
                </>
              ) : (
                <Button
                  className="font-bold"
                  onClick={isDrawingComplete ? startNewDrawing : initializeDrawing}
                  disabled={isDrawingPolygon}
                >
                  {isDrawingComplete ? "Start New Route" : "Generate Data"}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MapProduct

