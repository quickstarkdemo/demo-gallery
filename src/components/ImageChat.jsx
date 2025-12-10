import React, { useState, useRef, useEffect } from "react";
import {
    Box,
    Button,
    VStack,
    HStack,
    Input,
    Text,
    Image,
    Spinner,
    Select,
    IconButton,
    NativeSelect,
    useToast, // Using useToast from Chakra UI directly or useAppToaster if available
    Stack
} from "@chakra-ui/react";
import { FiSend, FiSave, FiImage, FiCpu, FiRefreshCw } from "react-icons/fi";
import { useAppToaster } from "../hooks/useAppToaster";

// Use the same base URL as Home.jsx, assuming it's the correct one for image operations
const API_BASE_URL = "https://api-images.quickstark.com/api/v1";

const ImageChat = ({ onImageSave }) => {
    const [messages, setMessages] = useState([]);
    const [prompt, setPrompt] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [selectedModel, setSelectedModel] = useState("gemini-3-pro-image-preview");
    const [resolution, setResolution] = useState("1024x1024");

    const scrollRef = useRef(null);
    const toaster = useAppToaster();

    // Scroll to bottom on new message
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    const handleSendMessage = async () => {
        if (!prompt.trim()) return;

        const userMessage = { role: "user", parts: [{ text: prompt }] };
        const newMessages = [...messages, userMessage];

        setMessages(newMessages);
        setPrompt("");
        setIsLoading(true);

        try {
            // Prepare payload for multi-turn api
            // The API expects: { model, size, messages: [...] }
            // Each message part needs specific formatting.

            const payloadMessages = newMessages.map(msg => {
                // Ensure we send correct structure to backend
                // If it's an assistant message with image, we might need to send back the image_base64 or reference
                // For now, let's assume we send what we have, but we might need to optimize if images are large
                // The nano-banana.md example shows specific "image_base64" field for assistant parts.

                return {
                    role: msg.role,
                    parts: msg.parts.map(part => {
                        if (part.image_base64) {
                            return {
                                image_base64: part.image_base64,
                                mime_type: part.mime_type
                            };
                        }
                        return { text: part.text };
                    })
                };
            });

            const response = await fetch(`${API_BASE_URL}/gemini-edit-image`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: selectedModel,
                    size: resolution,
                    messages: payloadMessages
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `API Error: ${response.status}`);
            }

            const data = await response.json();
            // Expecting: { model, mime_type, image_base64, prompt, size }

            if (!data.image_base64) {
                throw new Error("No image data received from API");
            }

            const assistantMessage = {
                role: "assistant",
                parts: [{
                    image_base64: data.image_base64,
                    mime_type: data.mime_type || "image/png"
                }]
            };

            setMessages([...newMessages, assistantMessage]);

        } catch (error) {
            console.error("Chat error:", error);
            toaster.create({
                title: "Generation Failed",
                description: error.message || "Failed to generate image",
                status: "error",
                duration: 5000,
            });
            // Optionally remove the last user message if failed, or just show error
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveImage = (base64Data, mimeType) => {
        // Convert base64 to file and call parent callback
        try {
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType });

            const timestamp = new Date().getTime();
            const filename = `ai-chat-edit-${timestamp}.png`;
            const file = new File([blob], filename, { type: mimeType });

            if (onImageSave) {
                onImageSave(file);
            }
        } catch (e) {
            console.error("Error saving image:", e);
            toaster.create({
                title: "Save Failed",
                description: "Could not prepare image for saving.",
                status: "error",
                duration: 3000,
            });
        }
    };

    const handleClearChat = () => {
        setMessages([]);
        setPrompt("");
    };

    return (
        <Box
            w="100%"
            maxW="600px"
            bg="gray.800"
            borderRadius="xl"
            border="1px solid"
            borderColor="purple.500"
            boxShadow="0 0 20px rgba(128, 90, 213, 0.2)"
            overflow="hidden"
            display="flex"
            flexDirection="column"
            h="700px" // Fixed height for chat interface
        >
            {/* Header */}
            <Box p={4} borderBottom="1px solid" borderColor="gray.700" bg="gray.900">
                <HStack justify="space-between">
                    <HStack>
                        <FiCpu color="#D6BCFA" />
                        <Text color="purple.300" fontWeight="bold">Nano Banana Chat</Text>
                    </HStack>
                    <Button size="xs" colorScheme="red" variant="ghost" onClick={handleClearChat}>
                        Clear
                    </Button>
                </HStack>

                {/* Controls */}
                <Stack direction={{ base: "column", md: "row" }} mt={3} spacing={2}>
                    <NativeSelect.Root size="sm" width="auto">
                        <NativeSelect.Field
                            value={resolution}
                            onChange={(e) => setResolution(e.target.value)}
                            bg="gray.800"
                            borderColor="gray.600"
                        >
                            <option value="1024x1024">1024x1024</option>
                            <option value="512x512">512x512</option>
                            <option value="1280x720">1280x720</option>
                            <option value="720x1280">720x1280</option>
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                    </NativeSelect.Root>

                    <NativeSelect.Root size="sm" width="auto">
                        <NativeSelect.Field
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            bg="gray.800"
                            borderColor="gray.600"
                        >
                            <option value="gemini-3-pro-image-preview">Gemini 3 Pro</option>
                            <option value="gemini-2.5-flash-image">Gemini 2.5 Flash</option>
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                    </NativeSelect.Root>
                </Stack>
            </Box>

            {/* Chat Area */}
            <Box
                flex="1"
                overflowY="auto"
                p={4}
                css={{
                    '&::-webkit-scrollbar': { width: '4px' },
                    '&::-webkit-scrollbar-track': { width: '6px' },
                    '&::-webkit-scrollbar-thumb': { background: '#555', borderRadius: '24px' },
                }}
                ref={scrollRef}
            >
                {messages.length === 0 && (
                    <VStack h="100%" justify="center" opacity={0.5} spacing={4}>
                        <FiImage size="48px" color="gray" />
                        <Text color="gray.400" textAlign="center">
                            Start a conversation to generate and edit images.<br />
                            Try "Create a cyberpunk city" then "Make it rainy".
                        </Text>
                    </VStack>
                )}

                {messages.map((msg, idx) => (
                    <Box key={idx} mb={4} alignSelf={msg.role === 'user' ? 'flex-end' : 'flex-start'}>
                        {msg.role === 'user' ? (
                            <Box
                                bg="purple.600"
                                color="white"
                                p={3}
                                borderRadius="lg"
                                borderBottomRightRadius="0"
                                maxW="80%"
                                ml="auto"
                            >
                                <Text fontSize="sm">{msg.parts[0].text}</Text>
                            </Box>
                        ) : (
                            <VStack align="start" spacing={2} maxW="100%">
                                <Box
                                    bg="gray.700"
                                    p={2}
                                    borderRadius="lg"
                                    borderTopLeftRadius="0"
                                    border="1px solid"
                                    borderColor="gray.600"
                                >
                                    {msg.parts[0].image_base64 && (
                                        <VStack>
                                            <Image
                                                src={`data:${msg.parts[0].mime_type};base64,${msg.parts[0].image_base64}`}
                                                borderRadius="md"
                                                maxH="300px"
                                                objectFit="contain"
                                            />
                                            <Button
                                                size="xs"
                                                leftIcon={<FiSave />}
                                                colorScheme="green"
                                                variant="solid"
                                                onClick={() => handleSaveImage(msg.parts[0].image_base64, msg.parts[0].mime_type)}
                                                w="full"
                                            >
                                                Save to Gallery
                                            </Button>
                                        </VStack>
                                    )}
                                </Box>
                            </VStack>
                        )}
                    </Box>
                ))}

                {isLoading && (
                    <Box alignSelf="flex-start" bg="gray.700" p={3} borderRadius="lg" borderTopLeftRadius="0">
                        <HStack spacing={2}>
                            <Spinner size="xs" color="purple.400" />
                            <Text fontSize="xs" color="gray.400">Thinking...</Text>
                        </HStack>
                    </Box>
                )}
            </Box>

            {/* Input Area */}
            <Box p={4} bg="gray.900" borderTop="1px solid" borderColor="gray.700">
                <HStack>
                    <Input
                        placeholder="Describe your image or edit..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                        bg="gray.800"
                        border="none"
                        _focus={{ ring: 2, ringColor: "purple.500" }}
                        disabled={isLoading}
                    />
                    <IconButton
                        icon={<FiSend />}
                        colorScheme="purple"
                        onClick={handleSendMessage}
                        disabled={isLoading || !prompt.trim()}
                        isLoading={isLoading}
                        aria-label="Send message"
                    />
                </HStack>
            </Box>
        </Box>
    );
};

export default ImageChat;
