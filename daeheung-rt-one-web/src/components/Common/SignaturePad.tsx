import React, { useRef, useEffect, useState } from 'react';
import { Box, Button, Typography, Paper } from '@mui/material';
import { Clear as ClearIcon } from '@mui/icons-material';

interface SignaturePadProps {
  onSave: (signature: string) => void;
  onCancel?: () => void;
  width?: number;
  height?: number;
  disabled?: boolean;
  signature?: string; // 기존 서명 이미지
}

const SignaturePad: React.FC<SignaturePadProps> = ({
  onSave,
  onCancel,
  width = 400,
  height = 200,
  disabled = false,
  signature
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(!!signature);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Canvas 설정
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 기존 서명이 있으면 표시
    if (signature) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasSignature(true);
      };
      img.src = signature;
    } else {
      // 배경을 흰색으로 설정
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [signature]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas || disabled) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;

    const signatureData = canvas.toDataURL('image/png');
    onSave(signatureData);
  };

  return (
    <Box>
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          border: '2px dashed',
          borderColor: 'divider',
          borderRadius: 2,
          bgcolor: 'grey.50'
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          서명란
        </Typography>
        <Box
          sx={{
            position: 'relative',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'white',
            overflow: 'hidden'
          }}
        >
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{
              cursor: disabled ? 'not-allowed' : 'crosshair',
              display: 'block',
              width: '100%',
              height: '100%'
            }}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mt: 2, justifyContent: 'flex-end' }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ClearIcon />}
            onClick={clear}
            disabled={disabled || !hasSignature}
          >
            지우기
          </Button>
          {onCancel && (
            <Button
              size="small"
              variant="outlined"
              onClick={onCancel}
              disabled={disabled}
            >
              취소
            </Button>
          )}
          <Button
            size="small"
            variant="contained"
            onClick={save}
            disabled={disabled || !hasSignature}
          >
            서명 저장
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default SignaturePad;



