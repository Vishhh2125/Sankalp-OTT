import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { API_BASE_URL } from '../constants/config';

const DOWNLOADS_KEY = '@offline_downloads';
const DOWNLOADS_DIR = FileSystem.documentDirectory + 'downloads/';
const THUMBNAILS_DIR = FileSystem.documentDirectory + 'downloads/thumbnails/';

// Ensure directories exist
const ensureDirectories = async () => {
  const dlInfo = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
  if (!dlInfo.exists) {
    await FileSystem.makeDirectoryAsync(DOWNLOADS_DIR, { intermediates: true });
  }
  const thInfo = await FileSystem.getInfoAsync(THUMBNAILS_DIR);
  if (!thInfo.exists) {
    await FileSystem.makeDirectoryAsync(THUMBNAILS_DIR, { intermediates: true });
  }
};

const getFixedUrl = (url) => {
  if (!url) return url;
  let fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  if (fullUrl.includes('://10.') || fullUrl.includes('://192.') || fullUrl.includes('://172.')) {
    const apiHost = API_BASE_URL.split('://')[1].split(':')[0];
    fullUrl = fullUrl.replace(/:\/\/[^\/:]+/, `://${apiHost}`);
  }
  return fullUrl;
};

export const getDownloadedEpisodes = async () => {
  try {
    const data = await AsyncStorage.getItem(DOWNLOADS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Error fetching downloads from storage', e);
    return [];
  }
};

export const isDownloaded = async (episodeId) => {
  const downloads = await getDownloadedEpisodes();
  return downloads.some(d => d.episodeId === episodeId);
};

export const startDownload = async (episodeId, onProgress) => {
  console.log(`[DownloadManager] ensureDirectories for ${episodeId}`);
  await ensureDirectories();
  
  try {
    console.log(`[DownloadManager] Fetching download URL for ${episodeId}`);
    // 1. Get download URL from backend
    const response = await api.get(`/api/media/download-url/${episodeId}`, {
      baseURL: API_BASE_URL
    });
    const data = response.data;
    console.log(`[DownloadManager] Received download metadata:`, JSON.stringify(data));
    
    // 2. Download thumbnail if available
    let localImagePath = null;
    if (data.thumbnail_url) {
      const fullThumbUrl = getFixedUrl(data.thumbnail_url);
      localImagePath = THUMBNAILS_DIR + `${data.show_name?.replace(/[^a-zA-Z0-9]/g, '_')}_${episodeId}.jpg`;
      const thInfo = await FileSystem.getInfoAsync(localImagePath);
      if (!thInfo.exists) {
        await FileSystem.downloadAsync(fullThumbUrl, localImagePath);
      }
    }
    
    // 3. Start video download
    const fullDownloadUrl = getFixedUrl(data.download_url);
    const localVideoPath = DOWNLOADS_DIR + `${episodeId}.bin`;
    
    const downloadResumable = FileSystem.createDownloadResumable(
      fullDownloadUrl,
      localVideoPath,
      {},
      (downloadProgress) => {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        if (onProgress) onProgress(progress);
      }
    );

    const { uri, status } = await downloadResumable.downloadAsync();
    
    if (status !== 200) {
      throw new Error(`Download failed with status ${status}`);
    }

    // 4. Save metadata to AsyncStorage
    const newDownload = {
      episodeId: data.episode_id,
      episodeNum: data.episode_num,
      title: data.title,
      showName: data.show_name,
      localVideoPath: uri,
      localImagePath: localImagePath,
      duration: data.duration_sec,
      downloadedAt: new Date().toISOString()
    };

    const currentDownloads = await getDownloadedEpisodes();
    // Remove if already exists
    const filtered = currentDownloads.filter(d => d.episodeId !== episodeId);
    filtered.push(newDownload);
    
    await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(filtered));
    return newDownload;
  } catch (error) {
    console.error('Download error:', error);
    throw error;
  }
};

export const removeDownload = async (episodeId) => {
  try {
    const downloads = await getDownloadedEpisodes();
    const item = downloads.find(d => d.episodeId === episodeId);
    
    if (item) {
      // Delete video file
      const vInfo = await FileSystem.getInfoAsync(item.localVideoPath);
      if (vInfo.exists) {
        await FileSystem.deleteAsync(item.localVideoPath);
      }
      
      // Update AsyncStorage
      const filtered = downloads.filter(d => d.episodeId !== episodeId);
      await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(filtered));
    }
  } catch (error) {
    console.error('Remove download error:', error);
    throw error;
  }
};
