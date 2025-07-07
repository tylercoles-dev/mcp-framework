#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import { spawn, ChildProcess } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

interface ProjectConfig {
    name: string;
    type: "node" | "python" | "react" | "nextjs" | "generic";
    directory: string;
    git?: boolean;
    dependencies?: string[];
}

interface DependencyConfig {
    type: "npm" | "pip" | "cargo";
    dependencies: string[];
    devDependencies?: string[];
    remove?: string[];
}

class IdeMcpServer {
    private server: Server;
    private serenaProcess?: ChildProcess;

    constructor() {
        this.server = new Server(
            {
                name: "mcp-ide-server",
                version: "1.0.0",
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.setupToolHandlers();
    }

    private setupToolHandlers() {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: "create_project",
                        description: "Create a new project directory with proper structure and initial files",
                        inputSchema: {
                            type: "object",
                            properties: {
                                name: { type: "string", description: "Project name" },
                                type: {
                                    type: "string",
                                    enum: ["node", "python", "react", "nextjs", "generic"],
                                    description: "Project type",
                                },
                                directory: { type: "string", description: "Base directory path" },
                                git: { type: "boolean", description: "Initialize git repository", default: true },
                                dependencies: {
                                    type: "array",
                                    items: { type: "string" },
                                    description: "Initial dependencies to install",
                                },
                            },
                            required: ["name", "type", "directory"],
                        },
                    },
                    {
                        name: "setup_workspace",
                        description: "Set up workspace with common configuration files and folder structure",
                        inputSchema: {
                            type: "object",
                            properties: {
                                projectPath: { type: "string", description: "Path to the project" },
                                includeVSCode: { type: "boolean", description: "Include VS Code settings", default: true },
                                includeGitignore: { type: "boolean", description: "Include .gitignore", default: true },
                                includeEditorConfig: { type: "boolean", description: "Include .editorconfig", default: true },
                                includePrettier: { type: "boolean", description: "Include Prettier config", default: true },
                            },
                            required: ["projectPath"],
                        },
                    },
                    {
                        name: "manage_dependencies",
                        description: "Add, remove, or update project dependencies with proper validation",
                        inputSchema: {
                            type: "object",
                            properties: {
                                projectPath: { type: "string", description: "Path to the project" },
                                type: {
                                    type: "string",
                                    enum: ["npm", "pip", "cargo"],
                                    description: "Package manager type",
                                },
                                dependencies: {
                                    type: "array",
                                    items: { type: "string" },
                                    description: "Dependencies to add",
                                },
                                devDependencies: {
                                    type: "array",
                                    items: { type: "string" },
                                    description: "Dev dependencies to add (npm only)",
                                },
                                remove: {
                                    type: "array",
                                    items: { type: "string" },
                                    description: "Dependencies to remove",
                                },
                            },
                            required: ["projectPath", "type"],
                        },
                    },
                    {
                        name: "git_commit",
                        description: "Stage and commit changes with a message",
                        inputSchema: {
                            type: "object",
                            properties: {
                                projectPath: { type: "string", description: "Path to the git repository" },
                                message: { type: "string", description: "Commit message" },
                                addAll: { type: "boolean", description: "Add all changes before committing", default: true },
                                files: {
                                    type: "array",
                                    items: { type: "string" },
                                    description: "Specific files to add (if addAll is false)",
                                },
                            },
                            required: ["projectPath", "message"],
                        },
                    },
                    {
                        name: "git_push",
                        description: "Push commits to remote repository",
                        inputSchema: {
                            type: "object",
                            properties: {
                                projectPath: { type: "string", description: "Path to the git repository" },
                                remote: { type: "string", description: "Remote name", default: "origin" },
                                branch: { type: "string", description: "Branch to push (current branch if not specified)" },
                                force: { type: "boolean", description: "Force push", default: false },
                                setUpstream: { type: "boolean", description: "Set upstream for new branch", default: false },
                            },
                            required: ["projectPath"],
                        },
                    },
                    {
                        name: "git_pull",
                        description: "Pull changes from remote repository",
                        inputSchema: {
                            type: "object",
                            properties: {
                                projectPath: { type: "string", description: "Path to the git repository" },
                                remote: { type: "string", description: "Remote name", default: "origin" },
                                branch: { type: "string", description: "Branch to pull from (current branch if not specified)" },
                                rebase: { type: "boolean", description: "Use rebase instead of merge", default: false },
                            },
                            required: ["projectPath"],
                        },
                    },
                    {
                        name: "git_branch",
                        description: "Create, switch, delete, or list git branches",
                        inputSchema: {
                            type: "object",
                            properties: {
                                projectPath: { type: "string", description: "Path to the git repository" },
                                action: {
                                    type: "string",
                                    enum: ["create", "switch", "delete", "list", "create-and-switch"],
                                    description: "Branch action to perform",
                                },
                                branchName: { type: "string", description: "Branch name (required for create, switch, delete)" },
                                fromBranch: { type: "string", description: "Source branch for new branch (defaults to current)" },
                                force: { type: "boolean", description: "Force delete branch", default: false },
                            },
                            required: ["projectPath", "action"],
                        },
                    },
                    {
                        name: "git_status",
                        description: "Get git repository status and information",
                        inputSchema: {
                            type: "object",
                            properties: {
                                projectPath: { type: "string", description: "Path to the git repository" },
                                porcelain: { type: "boolean", description: "Use porcelain format for parsing", default: false },
                            },
                            required: ["projectPath"],
                        },
                    },
                    {
                        name: "git_clone",
                        description: "Clone a git repository to a specified directory and return the project path",
                        inputSchema: {
                            type: "object",
                            properties: {
                                url: { type: "string", description: "Git repository URL (https or ssh)" },
                                directory: { type: "string", description: "Base directory to clone into" },
                                projectName: { type: "string", description: "Custom project name (defaults to repo name)" },
                                branch: { type: "string", description: "Specific branch to clone" },
                                depth: { type: "number", description: "Shallow clone depth (for faster cloning)" },
                                recursive: { type: "boolean", description: "Clone submodules recursively", default: false },
                                setupWorkspace: { type: "boolean", description: "Automatically setup workspace after clone", default: false },
                            },
                            required: ["url", "directory"],
                        },
                    },
                    {
                        name: "generate_ssh_key",
                        description: "Generate a new SSH key pair for git authentication and return the public key",
                        inputSchema: {
                            type: "object",
                            properties: {
                                email: { type: "string", description: "Email address for the SSH key" },
                                keyName: { type: "string", description: "Name for the key file", default: "id_rsa" },
                                keyType: {
                                    type: "string",
                                    enum: ["rsa", "ed25519", "ecdsa"],
                                    description: "SSH key type",
                                    default: "ed25519",
                                },
                                keySize: {
                                    type: "number",
                                    description: "Key size in bits (for RSA keys)",
                                    default: 4096,
                                },
                                passphrase: { type: "string", description: "Optional passphrase for the private key" },
                                overwrite: { type: "boolean", description: "Overwrite existing key if it exists", default: false },
                            },
                            required: ["email"],
                        },
                    },
                ] as Tool[],
            };
        });

        // Handle tool calls
        //this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
        //    const { name, arguments: args } = request.params;

        // switch (name) {
        //     case "create_project":
        //         return await this.createProject(args as ProjectConfig);
        //     case "setup_workspace":
        //         return await this.setupWorkspace(args as any);
        //     case "manage_dependencies":
        //         return await this.manageDependencies(args as DependencyConfig & { projectPath: string });
        //     case "git_commit":
        //         return await this.gitCommit(args as any);
        //     case "git_push":
        //         return await this.gitPush(args as any);
        //     case "git_pull":
        //         return await this.gitPull(args as any);
        //     case "git_branch":
        //         return await this.gitBranch(args as any);
        //     case "git_status":
        //         return await this.gitStatus(args as any);
        //     case "git_clone":
        //         return await this.gitClone(args as any);
        //     case "generate_ssh_key":
        //         return await this.generateSSHKey(args as any);
        //     default:
        //         throw new Error(`Unknown tool: ${name}`);
        //}
        //});
    }

    // ... rest of implementation continues from the main artifact

    async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
    }
}

// Start the server
const server = new IdeMcpServer();
server.start().catch(console.error);
