import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  Button,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Box,
  Container,
  Paper,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import Quiz from "@mui/icons-material/Quiz";

const getCanvasDimensions = () => {
  const width = Math.min(window.innerWidth - 24, 1064);
  return {
    width,
    height: Math.max(width / 3, 400),
  };
};

const DEFAULT_GRID_SIZE = 20;

// 7-segment patterns for digits 0-9
// TOP, TOP_RIGHT, BOTTOM_RIGHT, MIDDLE, BOTTOM_LEFT, TOP_LEFT, BOTTOM
const SEGMENT_PATTERNS = {
  0: [1, 1, 1, 0, 1, 1, 1],
  1: [0, 1, 1, 0, 0, 0, 0],
  2: [1, 1, 0, 1, 1, 0, 1],
  3: [1, 1, 1, 1, 0, 0, 1],
  4: [0, 1, 1, 1, 0, 1, 0],
  5: [1, 0, 1, 1, 0, 1, 1],
  6: [1, 0, 1, 1, 1, 1, 1],
  7: [1, 1, 1, 0, 0, 0, 0],
  8: [1, 1, 1, 1, 1, 1, 1],
  9: [1, 1, 1, 1, 0, 1, 1],
};

const StyledCard = styled(Card)(({ theme }) => ({
  margin: "2rem auto",
  padding: theme.spacing(3),
}));

const ControlsContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-around",
  gap: theme.spacing(4),
  marginBottom: theme.spacing(3),
}));

const GridContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  marginBottom: theme.spacing(3),
  transition: "all 0.3s ease-in-out",
}));

const GameControls = styled(Box)(() => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
}));

const Cell = styled("div")(({ alive, size }) => ({
  width: size,
  height: size,
  backgroundColor: alive ? "#000" : "#fff",
  cursor: "pointer",
  border: "1px solid #ddd",
  margin: 0,
  padding: 0,
  boxSizing: "border-box",
  transition: "all 0.3s ease-in-out",
}));

const createSegmentCoordinates = (startX, startY, digitWidth, digitHeight) => {
  const segmentThickness = Math.max(2, Math.floor(digitHeight / 10));
  const horizontalLength = digitWidth - 2 * segmentThickness;
  const verticalLength = (digitHeight - 3 * segmentThickness) / 2;

  return {
    // Horizontal segments [x, y, width, height]
    0: [startX + segmentThickness, startY, horizontalLength, segmentThickness], // TOP
    3: [
      startX + segmentThickness,
      startY + verticalLength + segmentThickness,
      horizontalLength,
      segmentThickness,
    ], // MIDDLE
    6: [
      startX + segmentThickness,
      startY + 2 * verticalLength + 2 * segmentThickness,
      horizontalLength,
      segmentThickness,
    ], // BOTTOM

    // Vertical segments [x, y, width, height]
    1: [
      startX + horizontalLength + segmentThickness,
      startY + segmentThickness,
      segmentThickness,
      verticalLength,
    ], // TOP_RIGHT
    2: [
      startX + horizontalLength + segmentThickness,
      startY + 2 * segmentThickness + verticalLength,
      segmentThickness,
      verticalLength,
    ], // BOTTOM_RIGHT
    4: [
      startX,
      startY + 2 * segmentThickness + verticalLength,
      segmentThickness,
      verticalLength,
    ], // BOTTOM_LEFT
    5: [startX, startY + segmentThickness, segmentThickness, verticalLength], // TOP_LEFT
  };
};

const GameOfLife = () => {
  const [dimensions, setDimensions] = useState(getCanvasDimensions());
  const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);
  const [renderMode, setRenderMode] = useState("canvas");
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [displayNumber, setDisplayNumber] = useState("");
  const [hasDisplayNumber, setHasDisplayNumber] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(500);
  const [rulesOpen, setRulesOpen] = useState(false);
  const lastUpdateTime = useRef(0);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef();

  useEffect(() => {
    let animationId;

    const animate = (timestamp) => {
      if (isRunning && !isPaused) {
        if (!lastUpdateTime.current) {
          lastUpdateTime.current = timestamp;
        }

        const elapsed = timestamp - lastUpdateTime.current;

        if (elapsed >= animationSpeed) {
          setGrid((prev) => getNextGeneration(prev));
          setGeneration((prev) => prev + 1);
          lastUpdateTime.current = timestamp;
        }

        animationId = requestAnimationFrame(animate);
      }
    };

    if (isRunning && !isPaused) {
      lastUpdateTime.current = 0; // Reset the last update time when starting
      animationId = requestAnimationFrame(animate);
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isRunning, isPaused, animationSpeed]);

  // Calculate cell size and grid dimensions
  const getGridDimensions = () => {
    const cellSize = Math.floor(dimensions.height / gridSize);
    const numColumns = Math.floor(dimensions.width / cellSize);

    return {
      cellSize,
      numColumns,
      numRows: gridSize,
      totalWidth: dimensions.width,
      totalHeight: dimensions.height,
    };
  };

  function createEmptyGrid() {
    const { numColumns, numRows } = getGridDimensions();
    return Array(numRows)
      .fill()
      .map(() => Array(numColumns).fill(false));
  }

  const [grid, setGrid] = useState(() => createEmptyGrid(DEFAULT_GRID_SIZE));

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setDimensions(getCanvasDimensions());
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleGridSizeChange = (newSize) => {
    const oldGrid = grid;
    const newGrid = Array(newSize)
      .fill()
      .map(() => {
        const { numColumns } = getGridDimensions();
        return Array(numColumns).fill(false);
      });

    const oldDims = getGridDimensions();
    const tempGridSize = gridSize;
    setGridSize(newSize);
    const newDims = getGridDimensions();
    setGridSize(tempGridSize);

    const scaleY = tempGridSize / newSize;
    const scaleX = oldDims.numColumns / newDims.numColumns;

    for (let i = 0; i < newSize; i++) {
      for (let j = 0; j < newDims.numColumns; j++) {
        const oldI = Math.floor(i * scaleY);
        const oldJ = Math.floor(j * scaleX);

        if (oldI < oldGrid.length && oldJ < oldGrid[0].length) {
          newGrid[i][j] = oldGrid[oldI][oldJ];
        }
      }
    }

    setGridSize(newSize);
    setGrid(newGrid);
  };

  // Apply digit pattern to grid
  const applyDigitPattern = (number) => {
    if (!number || number.length > 8) return;

    setGridSize(50);

    const newGrid = createEmptyGrid(50);
    const digits = String(number).split("");

    const { numColumns, numRows } = getGridDimensions();
    const digitWidth = Math.floor(numColumns / 10);
    const digitHeight = Math.floor(numRows / 1.5);
    const spacing = Math.floor(digitWidth / 4);

    digits.forEach((digit, index) => {
      const startX = spacing + index * (digitWidth + spacing);
      const startY = Math.floor((numRows - digitHeight) / 2);
      const coordinates = createSegmentCoordinates(
        startX,
        startY,
        digitWidth,
        digitHeight
      );

      SEGMENT_PATTERNS[parseInt(digit)].forEach((isOn, segmentIndex) => {
        if (isOn) {
          const [x, y, width, height] = coordinates[segmentIndex];
          for (let i = y; i < y + height && i < numRows; i++) {
            for (let j = x; j < x + width && j < numColumns; j++) {
              newGrid[i][j] = true;
            }
          }
        }
      });
    });

    setGrid(newGrid);
    setGeneration(0);
    setIsRunning(false);
    setIsPaused(false);
  };

  const handleNumberInput = (event) => {
    const value = event.target.value;
    if (/^\d{0,8}$/.test(value)) {
      setDisplayNumber(value);
      if (value) {
        setHasDisplayNumber(true);
        applyDigitPattern(value);
      } else {
        setHasDisplayNumber(false);
        handleReset();
      }
    }
  };

  const handleStart = () => {
    setIsRunning(true);
    setIsPaused(false);
    lastUpdateTime.current = performance.now();
  };

  const handlePause = () => {
    setIsPaused(true);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsPaused(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setGrid(createEmptyGrid(gridSize));
    setGeneration(0);
  };

  const handleInvert = () => {
    if (isRunning) {
      setIsRunning(false);
      setIsPaused(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
    const newGrid = grid.map((row) => row.map((cell) => !cell));
    setGrid(newGrid);
  };

  // Calculate next generation
  function getNextGeneration(currentGrid) {
    const newGrid = currentGrid.map((row) => [...row]);
    const numRows = currentGrid.length;
    const numCols = currentGrid[0].length;

    for (let i = 0; i < numRows; i++) {
      for (let j = 0; j < numCols; j++) {
        const neighbors = countNeighbors(currentGrid, i, j);
        if (currentGrid[i][j]) {
          newGrid[i][j] = neighbors === 2 || neighbors === 3;
        } else {
          newGrid[i][j] = neighbors === 3;
        }
      }
    }
    return newGrid;
  }

  function countNeighbors(grid, x, y) {
    let count = 0;
    const numRows = grid.length;
    const numCols = grid[0].length;

    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        if (i === 0 && j === 0) continue;
        const newX = x + i;
        const newY = y + j;
        if (newX >= 0 && newX < numRows && newY >= 0 && newY < numCols) {
          count += grid[newX][newY] ? 1 : 0;
        }
      }
    }
    return count;
  }

  // Handle cell click
  const handleCellClick = (x, y) => {
    const newGrid = grid.map((arr) => [...arr]);
    newGrid[x][y] = !newGrid[x][y];
    setGrid(newGrid);
  };

  // Canvas rendering
  useEffect(() => {
    if (renderMode === "canvas" && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const { cellSize, totalWidth, totalHeight } = getGridDimensions();

      canvas.style.transition = "all 0.3s ease-in-out";
      canvas.width = totalWidth;
      canvas.height = totalHeight;

      ctx.clearRect(0, 0, totalWidth, totalHeight);

      ctx.strokeStyle = "#ddd";
      const numCols = Math.floor(totalWidth / cellSize);

      for (let i = 0; i <= numCols; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellSize, 0);
        ctx.lineTo(i * cellSize, gridSize * cellSize);
        ctx.stroke();
      }

      for (let i = 0; i <= gridSize; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(numCols * cellSize, i * cellSize);
        ctx.stroke();
      }

      ctx.fillStyle = "#000";
      grid.forEach((row, i) => {
        row.forEach((cell, j) => {
          if (cell) {
            ctx.fillRect(
              j * cellSize,
              i * cellSize,
              cellSize - 1,
              cellSize - 1
            );
          }
        });
      });
    }
  }, [grid, renderMode, gridSize, dimensions]);

  const handleRulesOpen = () => {
    setRulesOpen(true);
  };

  const handleRulesClose = () => {
    setRulesOpen(false);
  };

  const StyledTypography = styled(Typography)(({ theme }) => ({
    fontWeight: 700,
    color:"#1976D2",
    textShadow: "2px 2px 4px rgba(0,0,0,0.1)",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    position: "relative",
  }));

  // SVG Grid
  const SVGGrid = () => {
    const { cellSize, totalWidth, numRows } = getGridDimensions();
    const numCols = totalWidth / cellSize;

    return (
      <svg
        width={numCols * cellSize}
        height={numRows * cellSize}
        style={{
          border: "1px solid #ddd",
          transition: "all 0.3s ease-in-out",
        }}
      >
        {grid.map((row, i) =>
          row.map((cell, j) => (
            <rect
              key={`${i}-${j}`}
              x={j * cellSize}
              y={i * cellSize}
              width={cellSize - 1}
              height={cellSize - 1}
              fill={cell ? "black" : "white"}
              stroke="#ddd"
              onClick={() => handleCellClick(i, j)}
              style={{ transition: "all 0.3s ease-in-out" }}
            />
          ))
        )}
      </svg>
    );
  };

  // DivGrid
  const DivGrid = () => {
    const { cellSize, numColumns, numRows } = getGridDimensions();

    return (
      <Paper
        elevation={1}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${numColumns}, ${cellSize}px)`,
          width: numColumns * cellSize,
          height: numRows * cellSize,
          padding: 0,
          gap: 0,
          border: "1px solid #ddd",
          overflow: "hidden",
          transition: "all 0.3s ease-in-out",
        }}
      >
        {grid.map((row, i) =>
          row.map((cell, j) => (
            <Cell
              key={`${i}-${j}`}
              alive={cell}
              size={cellSize}
              onClick={() => handleCellClick(i, j)}
            />
          ))
        )}
      </Paper>
    );
  };

  return (
    <Container>
      <StyledCard>
        <CardContent>
          <ControlsContainer>
            <StyledTypography variant="h5" gutterBottom>
              Game Of Life
            </StyledTypography>
            <FormControl style={{ minWidth: 100}}>
              <InputLabel>Render Mode</InputLabel>
              <Select
                value={renderMode}
                onChange={(e) => setRenderMode(e.target.value)}
                label="Render Mode"
                disabled={hasDisplayNumber}
                sx={{maxHeight:45}}
              >
                <MenuItem value="canvas">Canvas</MenuItem>
                <MenuItem value="svg">SVG</MenuItem>
                <MenuItem value="div">MUI</MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ width: 300, mx: 2 }}>
              <Typography gutterBottom>Grid Size:{gridSize}</Typography>
              <Slider
                value={gridSize}
                onChange={(_, value) => handleGridSizeChange(value)}
                min={10}
                max={50}
                step={1}
                valueLabelDisplay="auto"
                aria-label="Grid Size"
                disabled={hasDisplayNumber}
              />
            </Box>
            <TextField
              label="Display Number (upto 8-digits)"
              value={displayNumber}
              onChange={handleNumberInput}
              variant="outlined"
              size="small"
              style={{ minWidth: 200 }}
            />
            <Quiz
              sx={{ fontSize: 30, color: "#1976D2", cursor: "pointer" }}
              onClick={handleRulesOpen}
            />
          </ControlsContainer>
          <Dialog
            open={rulesOpen}
            onClose={handleRulesClose}
            aria-labelledby="rules-dialog-title"
            aria-describedby="rules-dialog-description"
          >
            <DialogTitle id="rules-dialog-title">
              {"Conway's Game of Life Rules"}
            </DialogTitle>
            <DialogContent>
              <DialogContentText id="rules-dialog-description">
                <Typography variant="h6" gutterBottom>
                  Basic Rules:
                </Typography>
                <Typography paragraph>
                  The Game of Life is played on a grid where each cell can be
                  either alive or dead. The next generation is calculated based
                  on these rules:
                </Typography>
                <Typography component="div" sx={{ mb: 2 }}>
                  1. Any live cell with fewer than two live neighbors dies
                  (underpopulation)
                </Typography>
                <Typography component="div" sx={{ mb: 2 }}>
                  2. Any live cell with two or three live neighbors lives on to
                  the next generation
                </Typography>
                <Typography component="div" sx={{ mb: 2 }}>
                  3. Any live cell with more than three live neighbors dies
                  (overpopulation)
                </Typography>
                <Typography component="div" sx={{ mb: 2 }}>
                  4. Any dead cell with exactly three live neighbors becomes a
                  live cell (reproduction)
                </Typography>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  How to Play:
                </Typography>
                <Typography component="div" sx={{ mb: 1 }}>
                  • Click on cells to toggle them between alive and dead states
                </Typography>
                <Typography component="div" sx={{ mb: 1 }}>
                  • Use the Start button to begin the simulation
                </Typography>
                <Typography component="div" sx={{ mb: 1 }}>
                  • Use the Pause button to temporarily stop the simulation
                </Typography>
                <Typography component="div" sx={{ mb: 1 }}>
                  • Use the Reset button to clear the grid
                </Typography>
                <Typography component="div" sx={{ mb: 1 }}>
                  • Use the Invert button to flip all cell states
                </Typography>
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleRulesClose} variant="contained" sx={{mr:6, mb:2}}>
                Got it!
              </Button>
            </DialogActions>
          </Dialog>
          <GridContainer>
            {renderMode === "canvas" && (
              <canvas
                ref={canvasRef}
                onClick={(e) => {
                  const rect = canvasRef.current.getBoundingClientRect();
                  const { cellSize } = getGridDimensions();
                  const x = Math.floor((e.clientY - rect.top) / cellSize);
                  const y = Math.floor((e.clientX - rect.left) / cellSize);
                  if (x >= 0 && x < gridSize && y >= 0 && y < grid[0].length) {
                    handleCellClick(x, y);
                  }
                }}
                style={{ cursor: "pointer" }}
              />
            )}
            {renderMode === "svg" && <SVGGrid />}
            {renderMode === "div" && <DivGrid />}
          </GridContainer>

          <GameControls>
            <Box sx={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Typography variant="h6">Generation: {generation}</Typography>
            </Box>

            <Box sx={{ width: 200 }}>
              <Slider
                value={animationSpeed}
                onChange={(_, value) => setAnimationSpeed(value)}
                min={100}
                max={1300}
                step={50}
                valueLabelDisplay="auto"
                aria-label="Animation Speed"
                size="small"
                marks={[
                  { value: 100, label: "Fast" },
                  { value: 700, label: "Medium" },
                  { value: 1300, label: "Slow" },
                ]}
              />
            </Box>

            <Box>
              <Button
                variant="contained"
                onClick={handleStart}
                disabled={isRunning && !isPaused}
                sx={{ mr: 2 }}
              >
                Start
              </Button>
              <Button
                variant="contained"
                onClick={handlePause}
                disabled={isPaused || !isRunning}
                sx={{ mr: 2 }}
              >
                Pause
              </Button>
              <Button
                variant="outlined"
                sx={{ mr: 2 }}
                onClick={() => {
                  handleReset();
                  setDisplayNumber("");
                  setHasDisplayNumber(false);
                }}
              >
                Reset
              </Button>
              <Button
                variant="outlined"
                disabled={isRunning}
                onClick={handleInvert}
              >
                Invert
              </Button>
            </Box>
          </GameControls>
        </CardContent>
      </StyledCard>
    </Container>
  );
};

export default GameOfLife;
