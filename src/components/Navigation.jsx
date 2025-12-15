import { Button, Center, Flex, Box, HStack } from "@chakra-ui/react";
import React from "react";
import { NavLink } from "react-router-dom";

export default function Navigation() {
  return (
    <Box bg='gray.900' px={4}>
      <Flex h={16} alignItems={'center'} justifyContent={'space-between'}>
        <Box>Image Gallery</Box>
        <Flex>
          <Button margin={2}>
            <NavLink
              to="/"
              style={({ isActive }) => {
                return isActive ? { color: "orange" } : { color: "gray" };
              }}
            >
              Home
            </NavLink>
          </Button>

          <Button margin={2}>
            <NavLink
              to="/about"
              style={({ isActive }) => {
                return isActive ? { color: "orange" } : { color: "gray" };
              }}
            >
              About
            </NavLink>
          </Button>

          <Button margin={2}>
            <NavLink
              to="/form"
              style={({ isActive }) => {
                return isActive ? { color: "orange" } : { color: "gray" };
              }}
            >
              Forms
            </NavLink>
          </Button>

          <Button margin={2}>
            <NavLink
              to="/error"
              style={({ isActive }) => {
                return isActive ? { color: "orange" } : { color: "gray" };
              }}
            >
              Force Error
            </NavLink>
          </Button>

          <Button margin={2}>
            <NavLink
              to="/kafka"
              style={({ isActive }) => {
                return isActive ? { color: "orange" } : { color: "gray" };
              }}
            >
              Kafka Demo
            </NavLink>
          </Button>
        </Flex>
      </Flex>
    </Box>
  );
}
