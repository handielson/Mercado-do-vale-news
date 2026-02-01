
import imageCompression from 'browser-image-compression';

/**
 * Image Compression Utility
 * Compresses images to max 1MB and 1920px for optimal storage
 */

interface CompressionOptions {
    maxSizeMB: number;
    maxWidthOrHeight: number;
    useWebWorker: boolean;
    fileType: string;
}

const DEFAULT_OPTIONS: CompressionOptions = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'image/jpeg'
};

/**
 * Compress an image file
 * @param file - Original image file
 * @returns Compressed image file (JPEG, max 1MB, max 1920px)
 */
export async function compressImage(file: File): Promise<File> {
    try {
        const compressedFile = await imageCompression(file, DEFAULT_OPTIONS);

        console.log(`🖼️ Image compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);

        return compressedFile;
    } catch (error) {
        console.error('Error compressing image:', error);
        throw new Error('Erro ao comprimir imagem');
    }
}

/**
 * Compress multiple images
 * @param files - Array of image files
 * @returns Array of compressed image files
 */
export async function compressImages(files: File[]): Promise<File[]> {
    return Promise.all(files.map(file => compressImage(file)));
}
