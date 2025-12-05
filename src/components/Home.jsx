import {
  FiUpload,
  FiMessageCircle,
  FiTrash2,
  FiAlertTriangle,
  FiChevronDown,
  FiChevronUp,
  FiCpu,
} from "react-icons/fi";
import {
  Box,
  Button,
  Center,
  Heading,
  IconButton,
  Image,
  Input,
  InputGroup,
  Link,
  SimpleGrid,
  Stack,
  Text,
  VStack,
  useMediaQuery,
  FileUpload,
  Tag,
  Wrap,
  WrapItem,
  Collapsible,
} from "@chakra-ui/react";
import "react-medium-image-zoom/dist/styles.css";
import { datadogRum } from '@datadog/browser-rum';

import { useEffect, useRef, useState } from "react";

import axios from "axios";
import apiClient from "../utils/apiClient";
import React from "react";

import { useEnvContext } from "./Context";
import { useAppToaster } from "../hooks/useAppToaster";

const api_base_url = import.meta.env.VITE_API_URL;

/**
 * Generates a random policy value for Datadog RUM testing and demo purposes
 * @returns {string} Random policy from predefined list (standard|premium|enterprise|basic|trial)
 */
const generateRandomPolicy = () => {
  const policies = ['standard', 'premium', 'enterprise', 'basic', 'trial'];
  return policies[Math.floor(Math.random() * policies.length)];
};

/**
 * Sends a custom action to Datadog RUM with policy attributes for monitoring
 * @param {string} actionName - Name of the action being tracked
 * @param {Object} additionalAttributes - Additional attributes to include in the action
 * @returns {string} The generated policy value used for this action
 */
const sendCustomAction = (actionName, additionalAttributes = {}) => {
  const policyValue = generateRandomPolicy();

  // Send custom action to Datadog RUM
  datadogRum.addAction(actionName, {
    policy: policyValue,
    ...additionalAttributes
  });

  console.log(`Custom action "${actionName}" sent with policy: ${policyValue}`);
  return policyValue;
};

/**
 * Custom error class for validation errors with Datadog RUM integration
 * Automatically logs errors to Datadog when instantiated
 */
class ValidationError extends Error {
  /**
   * Create a validation error with Datadog logging
   * @param {string} message - Error message to display and log
   */
  constructor(message) {
    super(message);
    this.name = `ERROR on - "${message}" `;

    // Create an instance of the error
    const error = new Error(message);

    // Adding the error instance to Datadog RUM
    datadogRum.addError(error, {
      message: this.name,
      stack: error.stack,
      source: "Home.jsx",
      type: "Error"
    });
  }
}

const onUnhandledError = async (message) => {
  try {
    throw new Error(message);
  } catch {
    console.log(`Error: ${message}`);
  }
};

/**
 * Home component - Main image gallery interface
 * 
 * Provides functionality for:
 * - Image upload with drag & drop support
 * - Image display in responsive grid layout
 * - Backend switching (MongoDB/PostgreSQL)
 * - Error generation for monitoring demos
 * - Comprehensive Datadog RUM integration
 * - Smart fallback to mock data when API unavailable
 * 
 * @component
 * @returns {JSX.Element} The main gallery interface
 */
export default function Home() {
  const [activeBackend, setActiveBackend] = useEnvContext();
  const [allImages, setAllImages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isSelected, setIsSelected] = useState(false);
  const [isUploadSuccessful, setIsUploadSuccessful] = useState(false);
  const [isDeleteSuccessful, setIsDeleteSuccessful] = useState(false);
  const [isLargerThan1200] = useMediaQuery("(min-width: 1200px)");
  const [expandedDropdowns, setExpandedDropdowns] = useState({});
  const [fileUploadKey, setFileUploadKey] = useState(0); // Key to force FileUpload reset
  const fileUploadRef = useRef(null);
  const toaster = useAppToaster();

  // AI Generation State
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const cols = isLargerThan1200 ? 4 : 1;

  /**
   * Converts a string to mixed case (title case)
   * @param {string} str - The string to convert
   * @returns {string} String with first letter of each word capitalized
   */
  const toMixedCase = (str) => {
    return str
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getImages = async () => {
    try {
      const res = await apiClient({
        method: "get",
        url: `/images`,
        params: { backend: activeBackend },
      });
      const data = await res.data;
      return data;
    } catch (error) {
      // Smart fallback handling - use mock data when API is unavailable
      const isDevelopment = import.meta.env.VITE_ENVIRONMENT === 'dev';
      const isNetworkError = error.code === 'ERR_NETWORK' ||
        error.code === 'ERR_NAME_NOT_RESOLVED' ||
        error.code === 'ECONNREFUSED' ||
        error.message?.includes('CORS');

      if (isDevelopment && isNetworkError) {
        console.log('🧪 API unavailable in development, using mock data');
        return [
          {
            id: 'mock-1',
            name: 'sample-image-1.jpg',
            url: '/qs.png',
            ai_labels: ['demo', 'sample', 'test'],
            ai_text: ['Sample', 'Image']
          },
          {
            id: 'mock-2',
            name: 'sample-image-2.jpg',
            url: '/qs.png',
            ai_labels: ['gallery', 'example', 'mock'],
            ai_text: ['Gallery', 'Demo']
          }
        ];
      }
      // Re-throw error for production or non-network errors
      throw error;
    }
  };

  /**
   * Posts an image to the API with form data
   * @param {string} url - The API endpoint URL
   * @param {FormData} formdata - Form data containing the image file
   * @returns {Promise<Object>} Axios response object
   */
  const postImage = async (url, formdata) => {
    const res = await axios({
      method: "post",
      url: url,
      data: formdata,
      params: { backend: activeBackend },
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res;
  };

  /**
   * Deletes an image from the API by ID
   * @param {string|number} id - The image ID to delete
   * @returns {Promise<Object>} Axios response object
   */
  const delImage = async (id) => {
    const res = await axios({
      method: "delete",
      params: { backend: activeBackend },
      url: `${api_base_url}/delete_image/${id}`,
    });
    return res;
  };

  /**
   * Handles file selection with enhanced validation and user feedback
   * Works with both traditional file inputs and Chakra UI FileUpload
   * Always REPLACES previous selection (does not accumulate)
   * @param {Object} details - File selection details from Chakra UI FileUpload
   */
  const handleFileSelection = (details) => {
    const files = details?.acceptedFiles || details?.files || [];
    console.log('handleFileSelection called with:', files.length, 'files');

    // Always start fresh - clear any previous selections
    if (!files || files.length === 0) {
      setIsSelected(false);
      setSelectedFiles([]);
      return;
    }

    // Validate file count (max 10)
    if (files.length > 10) {
      toaster.create({
        title: "Too Many Files",
        description: "Please select up to 10 images at a time.",
        status: "warning",
        duration: 4000,
      });
      // Reset to empty on validation failure
      setIsSelected(false);
      setSelectedFiles([]);
      return;
    }

    // Validate file types (images only)
    const invalidFiles = files.filter(file => !file.type.startsWith('image/'));
    if (invalidFiles.length > 0) {
      toaster.create({
        title: "Invalid File Type",
        description: `${invalidFiles.length} file(s) are not images and will be ignored.`,
        status: "warning",
        duration: 4000,
      });
    }

    const validFiles = files.filter(file => file.type.startsWith('image/'));

    // REPLACE (not accumulate) the selected files
    if (validFiles.length > 0) {
      setIsSelected(true);
      setSelectedFiles(validFiles); // This replaces the entire array
      console.log('Replaced with valid files:', validFiles.length);

      // User feedback for successful selection
      toaster.create({
        title: "Files Selected",
        description: `${validFiles.length} image(s) ready for upload.`,
        status: "success",
        duration: 2000,
      });
    } else {
      // No valid files, reset everything
      setIsSelected(false);
      setSelectedFiles([]);
    }
  };

  /**
   * Legacy file input handler for backward compatibility
   * @param {Event} e - File input change event
   */
  const handleFileInputChange = (e) => {
    const files = e.target.files;
    handleFileSelection({ files: Array.from(files || []) });
  };

  const onFileUpload = async (e) => {
    if (selectedFiles.length === 0) {
      toaster.create({
        title: `Select Images`,
        description: `Please select one or more images to upload`,
        status: "error",
        duration: 4000,
      });
      return;
    }

    setIsLoading(true);
    const uploadResults = [];

    try {
      for (const file of selectedFiles) {
        const formdata = new FormData();
        formdata.append("file", file, file.name);

        // Send custom action before upload
        const policyValue = sendCustomAction('image_upload_started', {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          totalFiles: selectedFiles.length
        });

        try {
          const res = await postImage(`${api_base_url}/add_image`, formdata);

          // Send another custom action after upload completes
          sendCustomAction('image_upload_completed', {
            fileName: file.name,
            status: res.status,
            backend: activeBackend
          });

          if (res.data?.message.includes("questionable")) {
            uploadResults.push({ file: file.name, status: 'questionable', message: res.data.message });
          } else {
            uploadResults.push({ file: file.name, status: 'success', policy: policyValue });
          }
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
          uploadResults.push({ file: file.name, status: 'error', error: error.message });

          // Send error to Datadog
          datadogRum.addError(error, {
            context: 'file_upload',
            fileName: file.name,
            backend: activeBackend
          });
        }
      }

      // Show summary toast
      const successCount = uploadResults.filter(r => r.status === 'success').length;
      const errorCount = uploadResults.filter(r => r.status === 'error').length;
      const questionableCount = uploadResults.filter(r => r.status === 'questionable').length;

      if (successCount > 0) {
        setIsUploadSuccessful(!isUploadSuccessful);
        toaster.create({
          title: `Upload Results`,
          description: `${successCount} successful, ${errorCount} failed, ${questionableCount} flagged`,
          status: successCount === selectedFiles.length ? "success" : "warning",
          duration: 6000,
        });
      }

      // Show individual error messages for questionable content
      uploadResults.filter(r => r.status === 'questionable').forEach(result => {
        toaster.create({
          title: `Questionable Content - ${result.file}`,
          description: result.message,
          status: "error",
          duration: 5000,
        });
      });

    } finally {
      setIsLoading(false);
      setSelectedFiles([]);
      setIsSelected(false);
      // Increment key to force FileUpload component to reset/remount
      setFileUploadKey(prev => prev + 1);
    }
  };

  const onFileDelete = async (image) => {
    const id = image.id || image._id?.$oid; // Mongo or Postgres
    console.log(`Delete: {db: ${activeBackend}, id: ${id}}`);

    // Send custom action before delete
    const policyValue = sendCustomAction('image_delete_started', {
      imageId: id,
      imageName: image.name,
      backend: activeBackend
    });

    // Set loading state for this specific image
    setDeletingImageId(id);

    try {
      const res = await delImage(id);

      // Send success custom action after delete completes
      sendCustomAction('image_delete_completed', {
        imageId: id,
        status: res.status,
        backend: activeBackend,
        success: true
      });

      // Fix: Check correct status codes for DELETE operations (200, 201, 204)
      if (res.status === 200 || res.status === 201 || res.status === 204) {
        setIsDeleteSuccessful(!isDeleteSuccessful);
        console.log('Delete successful:', res);

        // Show success notification
        toaster.create({
          title: `Delete Successful`,
          description: `Successfully deleted ${image.name} from ${toMixedCase(
            activeBackend
          )} with policy: ${policyValue}`,
          status: "success", // Fix: Changed from "error" to "success"
          duration: 3000,
        });
      } else {
        // Handle unexpected successful status codes
        console.warn('Unexpected delete response status:', res.status);
        toaster.create({
          title: `Delete Warning`,
          description: `Delete operation completed with unexpected status: ${res.status}`,
          status: "warning",
          duration: 4000,
        });
      }
    } catch (error) {
      console.error('Delete failed:', error);

      // Send failure custom action for monitoring
      sendCustomAction('image_delete_failed', {
        imageId: id,
        imageName: image.name,
        backend: activeBackend,
        error: error.message,
        status: error.response?.status || 'unknown',
        success: false
      });

      // Show user-friendly error notification
      const errorMessage = error.response?.data?.message ||
        error.response?.statusText ||
        error.message ||
        'Unknown error occurred';

      toaster.create({
        title: `Delete Failed`,
        description: `Failed to delete ${image.name}: ${errorMessage}`,
        status: "error",
        duration: 6000,
      });
    } finally {
      // Always clear delete loading state
      setDeletingImageId(null);
    }
  };

  const onSendError = async (image) => {
    // Add an attachment
    const name =
      image.name.substring(0, image.name.lastIndexOf(".")) || image.name;

    // Send custom action before error
    const policyValue = sendCustomAction('error_generation', {
      imageName: image.name,
      imageId: image.id || image._id?.$oid,
      labels: image.ai_labels,
      backend: activeBackend
    });

    await image.ai_labels.map((label, index) => {
    });

    toaster.create({
      title: "Error Sent",
      description: `We sent your ERROR on - ${image.name} with policy: ${policyValue}`,
      status: "success",
      duration: 5000,
    });

    // throw the error
    throw new ValidationError(image.name);
  };

  const handleGenerateAndUpload = async () => {
    if (!prompt) {
      toaster.create({
        title: "Prompt Required",
        description: "Please enter a prompt to generate an image.",
        status: "warning",
        duration: 3000,
      });
      return;
    }

    setIsGenerating(true);
    try {
      console.log("Generating image with prompt:", prompt);

      // Call backend API
      const response = await fetch("https://api-image.quickstark.com/api/v1/gemini-generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt,
          size: "1024x1024",
          model: "imagen-3.5-flash"
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `API Error: ${response.status}`);
      }

      const data = await response.json();
      const base64Image = data.image_base64;
      const mimeType = data.mime_type || "image/png";

      if (!base64Image) {
        throw new Error("No image data found in response");
      }

      // Convert base64 to File object
      const byteCharacters = atob(base64Image);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      const file = new File([blob], `ai-generated-${Date.now()}.png`, { type: mimeType });

      // Upload the file
      const formdata = new FormData();
      formdata.append("file", file, file.name);

      toaster.create({
        title: "Image Generated",
        description: "Uploading to database...",
        status: "info",
        duration: 2000,
      });

      const res = await postImage(`${api_base_url}/add_image`, formdata);

      if (res.status === 200 || res.status === 201) {
        toaster.create({
          title: "Success",
          description: "AI Image generated and uploaded successfully!",
          status: "success",
          duration: 5000,
        });
        setPrompt(""); // Clear prompt
        setIsUploadSuccessful(!isUploadSuccessful); // Trigger refresh
      }

    } catch (error) {
      console.error("Generation failed:", error);
      toaster.create({
        title: "Generation Failed",
        description: error.message || "Failed to generate image",
        status: "error",
        duration: 5000,
      });
    } finally {
      setIsGenerating(false);
    }
  };


  // Refresh after Upload or Delete
  useEffect(() => {
    const loadImages = async () => {
      setIsLoadingImages(true);
      try {
        const images = await getImages();
        setAllImages(images);
        localStorage.setItem("activeBackend", activeBackend);
      } catch (error) {
        console.error('Failed to load images:', error);

        // Determine error type and provide specific feedback
        let errorTitle = "Failed to Load Images";
        let errorDescription = `Could not load images from ${activeBackend}. Please try again.`;

        if (error.code === 'ERR_NETWORK' || error.code === 'ERR_NAME_NOT_RESOLVED') {
          errorTitle = "Network Connection Error";
          errorDescription = `Cannot connect to the API server. Using offline mode with sample data.`;
        } else if (error.code === 'ECONNREFUSED') {
          errorTitle = "Backend Server Unavailable";
          errorDescription = `Backend server is not responding. Using offline mode with sample data.`;
        } else if (error.message?.includes('CORS')) {
          errorTitle = "CORS Configuration Issue";
          errorDescription = `Cross-origin request blocked. Using offline mode with sample data.`;
        } else if (error.response?.status === 404) {
          errorTitle = "API Endpoint Not Found";
          errorDescription = `The images endpoint was not found. Using offline mode with sample data.`;
        }

        // Send error to Datadog with enhanced context
        datadogRum.addError(error, {
          context: 'image_loading',
          backend: activeBackend,
          operation: 'getImages',
          apiUrl: api_base_url,
          errorCode: error.code,
          httpStatus: error.response?.status
        });

        // Show enhanced user-friendly error
        toaster.create({
          title: errorTitle,
          description: errorDescription,
          status: "error",
          duration: 8000,
        });

        // Set empty array as fallback to prevent UI issues
        setAllImages([]);
      } finally {
        setIsLoadingImages(false);
      }
    };

    loadImages();
  }, [isUploadSuccessful, isDeleteSuccessful, activeBackend]);

  return (
    <Center>
      <VStack spacing={2}>
        <Image htmlWidth="400px" objectFit="contain" src={"/qs.png"}></Image>
        <Heading textAlign="center" color="purple.300" as="h2">
          I'm a Smart'ish{" "}
          <Link color="purple.400" href="https://datadoghq.com" isExternal>
            Gallery
          </Link>{" "}
        </Heading>
        <Heading textAlign={"center"} color="blue.300" size={"md"}>
          {" "}
          Note: Uploading a picture identified as a "bug" will generate a
          Backend Error
        </Heading>
        <br></br>

        {/* AI Generation Section */}
        <Box
          w="100%"
          maxW="600px"
          p={6}
          bg="gray.800"
          borderRadius="xl"
          border="1px solid"
          borderColor="purple.500"
          boxShadow="0 0 20px rgba(128, 90, 213, 0.2)"
        >
          <VStack spacing={4}>
            <Heading size="md" color="purple.300" display="flex" alignItems="center" gap={2}>
              <FiCpu /> AI Image Generation
            </Heading>
            <Text color="gray.400" fontSize="sm">
              Create images dynamically using the Nano Banana API
            </Text>
            <InputGroup size="lg">
              <Input
                placeholder="Describe the image you want to generate..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                bg="gray.700"
                border="none"
                _focus={{ ring: 2, ringColor: "purple.500" }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isGenerating) {
                    handleGenerateAndUpload();
                  }
                }}
              />
            </InputGroup>
            <Button
              w="full"
              colorScheme="purple"
              bgGradient="linear(to-r, purple.500, blue.500)"
              isLoading={isGenerating}
              loadingText="Dreaming up your image..."
              onClick={handleGenerateAndUpload}
              _hover={{
                bgGradient: "linear(to-r, purple.600, blue.600)",
                transform: "translateY(-2px)",
                boxShadow: "lg"
              }}
              transition="all 0.2s"
            >
              Generate & Upload
            </Button>
          </VStack>
        </Box>

        <br></br>
        <Center>
          <VStack spacing={5}>
            <FileUpload.Root
              key={fileUploadKey}
              multiple
              accept="image/*"
              maxFiles={10}
              onFileAccept={handleFileSelection}
              maxW="400px"
            >
              <FileUpload.HiddenInput />
              <FileUpload.Trigger asChild>
                <Button
                  bg="purple.500"
                  color="white"
                  size="lg"
                  width="100%"
                  _hover={{ bg: "purple.600" }}
                  aria-label="Select up to 10 images for upload"
                >
                  <FiUpload style={{ marginRight: '8px' }} />
                  Select Images (Max 10)
                </Button>
              </FileUpload.Trigger>

              <FileUpload.ItemGroup mt={3}>
                {selectedFiles.map((file, index) => (
                  <FileUpload.Item key={index} file={file}>
                    <FileUpload.ItemPreview type="image/*" />
                    <FileUpload.ItemName />
                    <FileUpload.ItemSizeText />
                    <FileUpload.ItemDeleteTrigger asChild>
                      <IconButton
                        size="sm"
                        colorScheme="red"
                        variant="ghost"
                        aria-label={`Remove ${file.name}`}
                      >
                        <FiTrash2 />
                      </IconButton>
                    </FileUpload.ItemDeleteTrigger>
                  </FileUpload.Item>
                ))}
              </FileUpload.ItemGroup>
            </FileUpload.Root>


            <Button
              bg="yellow.500"
              padding={5}
              size="lg"
              onClick={onFileUpload}
              loading={isLoading}
              loadingText={`Uploading ${selectedFiles.length} files...`}
              className="upload_button"
              disabled={selectedFiles.length === 0}
              color="black"
              _hover={{ bg: "yellow.600" }}
            >
              Upload {selectedFiles.length > 0 ? `${selectedFiles.length} Photos` : 'Photos'}
              <FiUpload style={{ marginLeft: '8px' }} />
            </Button>
          </VStack>
        </Center>
        <Stack spacing={4} direction="row" align="center" p={5}>
          <Button
            size="md"
            bg={activeBackend === 'mongo' ? 'purple.500' : 'gray.700'}
            color="white"
            border={activeBackend === 'mongo' ? '2px solid' : '2px solid'}
            borderColor={activeBackend === 'mongo' ? 'purple.400' : 'gray.500'}
            _hover={{
              bg: activeBackend === 'mongo' ? 'purple.600' : 'gray.600',
              borderColor: activeBackend === 'mongo' ? 'purple.300' : 'gray.400'
            }}
            onClick={() => {
              console.log('Switching to mongo');
              setActiveBackend('mongo');
            }}
          >
            Mongo
          </Button>
          <Button
            size="md"
            bg={activeBackend === 'postgres' ? 'purple.500' : 'gray.700'}
            color="white"
            border={activeBackend === 'postgres' ? '2px solid' : '2px solid'}
            borderColor={activeBackend === 'postgres' ? 'purple.400' : 'gray.500'}
            _hover={{
              bg: activeBackend === 'postgres' ? 'purple.600' : 'gray.600',
              borderColor: activeBackend === 'postgres' ? 'purple.300' : 'gray.400'
            }}
            onClick={() => {
              console.log('Switching to postgres');
              setActiveBackend('postgres');
            }}
          >
            Postgres
          </Button>
        </Stack>

        <br></br>
        <SimpleGrid
          columns={{ base: 1, md: 2, lg: cols }}
          gap={{ base: "20px", md: "30px", lg: "40px" }}
          maxW="1200px"
          mx="auto"
          px={{ base: 4, md: 6 }}
        >
          {isLoadingImages ? (
            <Center>
              <VStack spacing={4}>
                <Text color="purple.300" fontSize="lg">Loading images...</Text>
                <div style={{
                  width: '40px',
                  height: '40px',
                  border: '4px solid #E2E8F0',
                  borderTop: '4px solid #805AD5',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}>
                </div>
              </VStack>
            </Center>
          ) : allImages.length === 0 ? (
            <Center>
              <Text color="gray.500" fontSize="lg">No images found in {activeBackend}</Text>
            </Center>
          ) : (
            allImages.map((image) => {
              // Create a consistent unique key
              const uniqueKey = image.id || image._id?.$oid || `${image.name}-${image.url}`;
              const isDropdownOpen = expandedDropdowns[uniqueKey] || false;

              const toggleDropdown = () => {
                setExpandedDropdowns(prev => ({ ...prev, [uniqueKey]: !prev[uniqueKey] }));
              };

              return (
                <Box
                  key={uniqueKey}
                  className="image_container elevated-card"
                  maxW="300px"
                  position="relative"
                  borderRadius="xl"
                  overflow="hidden"
                  bg="gray.800"
                  cursor="pointer"
                  onClick={toggleDropdown}
                  role="button"
                  tabIndex={0}
                  aria-label={`View AI details for ${image.name}`}
                  aria-expanded={isDropdownOpen}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleDropdown();
                    }
                  }}
                  _focus={{
                    outline: "2px solid",
                    outlineColor: "purple.400",
                    outlineOffset: "2px"
                  }}
                >
                  <Box position="relative" display="inline-block">
                    <Box
                      position="absolute"
                      top="10px"
                      left="10px"
                      zIndex={10}
                      display="flex"
                      flexDirection="column"
                      gap="8px"
                    >
                      <IconButton
                        key={`error_button-${uniqueKey}`}
                        bg="gray.800"
                        color="yellow.300"
                        className="error_button"
                        colorScheme="yellow"
                        aria-label="Throw Error"
                        size="md"
                        onClick={() => onSendError(image)}
                      >
                        <FiAlertTriangle />
                      </IconButton>
                      <IconButton
                        key={`feedback_button-${uniqueKey}`}
                        bg="gray.800"
                        color="yellow.300"
                        className="feedback_button"
                        colorScheme="orange"
                        aria-label="Send Feedback"
                        size="md"
                        onClick={() => onUnhandledError("User Feedback Error")}
                      >
                        <FiMessageCircle />
                      </IconButton>
                      <IconButton
                        key={`delete_button-${uniqueKey}`}
                        bg="gray.800"
                        color="red.500"
                        className="delete_button"
                        colorScheme="red"
                        aria-label="Delete Image"
                        size="md"
                        loading={deletingImageId === (image.id || image._id?.$oid)}
                        onClick={() => onFileDelete(image)}
                      >
                        <FiTrash2 />
                      </IconButton>
                    </Box>
                    <Image
                      key={`image-${uniqueKey}`}
                      borderRadius={15}
                      boxSize="300px"
                      src={image.url}
                      objectFit="cover"
                      fallback={
                        <div
                          style={{
                            width: '300px',
                            height: '300px',
                            backgroundColor: '#2D3748',
                            borderRadius: '15px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#A0AEC0',
                            padding: '20px',
                            textAlign: 'center'
                          }}
                        >
                          <div style={{ fontSize: '18px', marginBottom: '10px' }}>📷</div>
                          <div style={{ fontSize: '14px' }}>Failed to Load</div>
                          <div style={{ fontSize: '12px', marginTop: '5px', opacity: 0.7 }}>
                            {image.name}
                          </div>
                        </div>
                      }
                      onError={(e) => {
                        console.error(`Failed to load image: ${image.url}`, e);

                        // Check if it's a 403 error (access denied)
                        const isAccessDenied = e.target.src.includes('quickstark-images.s3.amazonaws.com');

                        // Send error to Datadog with more context
                        datadogRum.addError(new Error(`Image load failed: ${image.name}`), {
                          imageUrl: image.url,
                          imageName: image.name,
                          backend: activeBackend,
                          errorType: isAccessDenied ? 'S3_ACCESS_DENIED' : 'GENERIC_LOAD_ERROR',
                          httpStatus: isAccessDenied ? '403' : 'unknown'
                        });
                      }}
                    ></Image>

                    {/* Filename Overlay */}
                    <Box
                      position="absolute"
                      bottom={0}
                      left={0}
                      right={0}
                      background="linear-gradient(transparent, rgba(0,0,0,0.9))"
                      p={4}
                      pt={12}
                    >
                      <Text
                        fontSize="lg"
                        fontWeight="semibold"
                        color="white"
                        noOfLines={2}
                        wordBreak="break-word"
                        textShadow="0 2px 4px rgba(0,0,0,0.9)"
                        letterSpacing="wide"
                        lineHeight="shorter"
                      >
                        {image.name}
                      </Text>
                    </Box>

                    {/* AI Details Content */}
                    <Box
                      position="relative"
                      bg="gray.800"
                      transition="all 0.3s ease-in-out"
                    >

                      <Collapsible.Root open={isDropdownOpen}>
                        <Collapsible.Content>
                          <VStack spacing={4} align="stretch" p={4} pb={12}>
                            {/* Text Detected Section */}
                            <Box>
                              <Text fontSize="sm" fontWeight="bold" color="orange.300" mb={2}>
                                Text Detected:
                              </Text>
                              {image.ai_text?.length > 0 ? (
                                <Text
                                  fontSize="xs"
                                  color="gray.300"
                                  wordBreak="break-word"
                                  bg="gray.700"
                                  p={2}
                                  borderRadius="sm"
                                >
                                  {image.ai_text.join(", ")}
                                </Text>
                              ) : (
                                <Text fontSize="xs" color="gray.300" fontStyle="italic">
                                  No Text Detected
                                </Text>
                              )}
                            </Box>

                            {/* Tags Section */}
                            <Box>
                              <Text fontSize="sm" fontWeight="bold" color="green.300" mb={2}>
                                Tags:
                              </Text>
                              {image.ai_labels?.length > 0 ? (
                                <Wrap spacing={1}>
                                  {image.ai_labels.map((label, index) => (
                                    <WrapItem key={index}>
                                      <Tag.Root size="sm" colorScheme="green" variant="solid">
                                        <Tag.Label>{label}</Tag.Label>
                                      </Tag.Root>
                                    </WrapItem>
                                  ))}
                                </Wrap>
                              ) : (
                                <Text fontSize="xs" color="gray.300" fontStyle="italic">
                                  No Labels Detected
                                </Text>
                              )}
                            </Box>
                          </VStack>
                        </Collapsible.Content>
                      </Collapsible.Root>
                    </Box>

                    {/* Elegant Chevron */}
                    <Box
                      position="absolute"
                      bottom={3}
                      right={3}
                      className="elegant-chevron"
                      borderRadius="full"
                      p={1.5}
                      transform={isDropdownOpen ? "rotate(180deg)" : "rotate(0deg)"}
                      _hover={{
                        transform: isDropdownOpen ? "rotate(180deg) scale(1.1)" : "rotate(0deg) scale(1.1)"
                      }}
                      zIndex={10}
                      cursor="pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDropdown();
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={isDropdownOpen ? "Collapse AI details" : "Expand AI details"}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleDropdown();
                        }
                      }}
                      _focus={{
                        outline: "2px solid",
                        outlineColor: "purple.400",
                        outlineOffset: "1px"
                      }}
                    >
                      <FiChevronDown
                        size={12}
                        color="rgba(255,255,255,0.8)"
                        style={{
                          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                      />
                    </Box>
                  </Box>
                </Box>
              );
            })
          )}
        </SimpleGrid>
      </VStack>
    </Center>
  );
}
