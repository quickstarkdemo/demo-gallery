import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Button,
    Container,
    Flex,
    Heading,
    Text,
    Badge,
    SimpleGrid,
    Stat,
    StatLabel,
    StatNumber,
    StatHelpText,
    VStack,
    HStack,
    FormControl,
    FormLabel,
    Switch,
    Slider,
    SliderTrack,
    SliderFilledTrack,
    SliderThumb,
    NumberInput,
    NumberInputField,
    NumberInputStepper,
    NumberIncrementStepper,
    NumberDecrementStepper,
    useToast,
    Divider,
    Code
} from '@chakra-ui/react';
import { FiPlay, FiSquare, FiActivity, FiServer } from 'react-icons/fi';

const API_BASE_URL = "https://api-images.quickstark.com/api/v1/kafka-demo";

const KafkaDemo = () => {
    const toast = useToast();
    const [status, setStatus] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    // Local state for fault injection form
    const [faultConfig, setFaultConfig] = useState({
        latency_ms: 0,
        drop_probability: 0,
        duplicate_ratio: 0,
        slow_consumer_ms: 0
    });

    const fetchStatus = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/status`);
            if (!response.ok) throw new Error('Failed to fetch status');
            const data = await response.json();
            setStatus(data);
            setLastUpdated(new Date());
            // Sync local fault config with server state if not currently editing? 
            // For now, let's just use what comes back to verify our changes
            if (!isLoading) {
                setFaultConfig(data.fault);
            }
        } catch (error) {
            console.error('Error fetching status:', error);
            // Don't show toast on polling errors to avoid spam
        }
    }, []);

    // Poll status every 3 seconds
    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 3000);
        return () => clearInterval(interval);
    }, [fetchStatus]);

    const handleStart = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rate_per_sec: 5,
                    scenario: "f1",
                    topic_prefix: "f1",
                    fault: faultConfig
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Failed to start demo');
            }

            const data = await response.json();
            setStatus(data);
            toast({
                title: "Demo Started",
                status: "success",
                duration: 3000,
            });
        } catch (error) {
            toast({
                title: "Error Starting Demo",
                description: error.message,
                status: "error",
                duration: 5000,
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleStop = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/stop`, {
                method: 'POST'
            });

            if (!response.ok) throw new Error('Failed to stop demo');

            // Immediately fetch status to confirm stop
            await fetchStatus();

            toast({
                title: "Demo Stopped",
                status: "info",
                duration: 3000,
            });
        } catch (error) {
            toast({
                title: "Error Stopping Demo",
                description: error.message,
                status: "error",
                duration: 5000,
            });
        } finally {
            setIsLoading(false);
        }
    };

    const updateFaults = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/fault`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fault: faultConfig })
            });

            if (!response.ok) throw new Error('Failed to update faults');

            await fetchStatus();
            toast({
                title: "Faults Updated",
                status: "success",
                duration: 2000,
            });

        } catch (error) {
            toast({
                title: "Update Failed",
                description: error.message,
                status: "error",
                duration: 5000,
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Container maxW="container.xl" py={8}>
            <VStack spacing={8} align="stretch">

                {/* Header Section */}
                <Flex justify="space-between" align="center" bg="gray.800" p={6} borderRadius="xl" shadow="lg">
                    <Box>
                        <Heading size="lg" color="white" mb={2}>Kafka Data Streams Demo</Heading>
                        <HStack>
                            <Badge colorScheme={status?.running ? "green" : "red"} fontSize="1em" px={3} py={1} borderRadius="full">
                                {status?.running ? "RUNNING" : "STOPPED"}
                            </Badge>
                            {status?.run_id && <Code fontSize="xs" bg="gray.700" p={1} borderRadius="md">{status.run_id}</Code>}
                        </HStack>
                    </Box>
                    <HStack spacing={4}>
                        <Button
                            leftIcon={<FiPlay />}
                            colorScheme="green"
                            onClick={handleStart}
                            isLoading={isLoading}
                            isDisabled={status?.running}
                            size="lg"
                        >
                            Start
                        </Button>
                        <Button
                            leftIcon={<FiSquare />}
                            colorScheme="red"
                            onClick={handleStop}
                            isLoading={isLoading}
                            isDisabled={!status?.running}
                            size="lg"
                        >
                            Stop
                        </Button>
                    </HStack>
                </Flex>

                {/* Metrics Grid */}
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
                    <Stat bg="gray.700" p={5} borderRadius="lg" shadow="md" color="white">
                        <StatLabel color="gray.300">Messages Produced</StatLabel>
                        <StatNumber fontSize="3xl">{status?.metrics?.produced || 0}</StatNumber>
                        <StatHelpText>Telemetry Raw</StatHelpText>
                    </Stat>

                    <Stat bg="gray.700" p={5} borderRadius="lg" shadow="md" color="white">
                        <StatLabel color="gray.300">Analytics Consumed</StatLabel>
                        <StatNumber fontSize="3xl">{status?.metrics?.analytics_consumed || 0}</StatNumber>
                        <StatHelpText>Enriched Data</StatHelpText>
                    </Stat>

                    <Stat bg="gray.700" p={5} borderRadius="lg" shadow="md" color="white">
                        <StatLabel color="gray.300">Alerts Processed</StatLabel>
                        <StatNumber fontSize="3xl">{status?.metrics?.alerts_consumed || 0}</StatNumber>
                        <StatHelpText>Critical Events</StatHelpText>
                    </Stat>
                </SimpleGrid>

                {/* Fault Injection Panel */}
                <Box bg="gray.800" p={6} borderRadius="xl" shadow="lg">
                    <Flex justify="space-between" align="center" mb={6}>
                        <Heading size="md" color="white">Fault Injection</Heading>
                        <Button size="sm" colorScheme="blue" onClick={updateFaults} isLoading={isLoading}>
                            Apply Changes
                        </Button>
                    </Flex>

                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={8}>
                        <FormControl>
                            <FormLabel color="gray.300">Latency Injection ({faultConfig.latency_ms}ms)</FormLabel>
                            <Slider
                                min={0} max={2000} step={50}
                                value={faultConfig.latency_ms}
                                onChange={(v) => setFaultConfig(c => ({ ...c, latency_ms: v }))}
                            >
                                <SliderTrack bg="gray.600"><SliderFilledTrack bg="orange.400" /></SliderTrack>
                                <SliderThumb />
                            </Slider>
                            <Text fontSize="xs" color="gray.500" mt={1}>Artificial delay in processing</Text>
                        </FormControl>

                        <FormControl>
                            <FormLabel color="gray.300">Slow Consumer ({faultConfig.slow_consumer_ms}ms)</FormLabel>
                            <Slider
                                min={0} max={2000} step={50}
                                value={faultConfig.slow_consumer_ms}
                                onChange={(v) => setFaultConfig(c => ({ ...c, slow_consumer_ms: v }))}
                            >
                                <SliderTrack bg="gray.600"><SliderFilledTrack bg="orange.400" /></SliderTrack>
                                <SliderThumb />
                            </Slider>
                            <Text fontSize="xs" color="gray.500" mt={1}>Simulate consumer lag</Text>
                        </FormControl>

                        <FormControl>
                            <FormLabel color="gray.300">Drop Probability ({(faultConfig.drop_probability * 100).toFixed(0)}%)</FormLabel>
                            <Slider
                                min={0} max={1} step={0.05}
                                value={faultConfig.drop_probability}
                                onChange={(v) => setFaultConfig(c => ({ ...c, drop_probability: v }))}
                            >
                                <SliderTrack bg="gray.600"><SliderFilledTrack bg="red.400" /></SliderTrack>
                                <SliderThumb />
                            </Slider>
                            <Text fontSize="xs" color="gray.500" mt={1}>Randomly drop messages</Text>
                        </FormControl>

                        <FormControl>
                            <FormLabel color="gray.300">Duplicate Ratio ({(faultConfig.duplicate_ratio * 100).toFixed(0)}%)</FormLabel>
                            <Slider
                                min={0} max={1} step={0.05}
                                value={faultConfig.duplicate_ratio}
                                onChange={(v) => setFaultConfig(c => ({ ...c, duplicate_ratio: v }))}
                            >
                                <SliderTrack bg="gray.600"><SliderFilledTrack bg="purple.400" /></SliderTrack>
                                <SliderThumb />
                            </Slider>
                            <Text fontSize="xs" color="gray.500" mt={1}>Re-emit existing messages</Text>
                        </FormControl>
                    </SimpleGrid>
                </Box>

                {/* Info Footer */}
                <Box textAlign="center" pt={4}>
                    <Text fontSize="sm" color="gray.500">
                        Data Streams: {status?.bootstrap_servers || '...'} | Last Sync: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'}
                    </Text>
                </Box>
            </VStack>
        </Container>
    );
};

export default KafkaDemo;
