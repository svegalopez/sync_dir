# Use an official Node.js runtime as the base image
FROM node:20

# Create app directory
WORKDIR /usr/src/app

# Install vim
RUN apt-get update && apt-get install -y vim

# Copy the client source code
COPY daemon.js ./
COPY client.js ./
COPY lib.js ./

# Install dependencies
COPY package*.json ./
RUN npm install

# Command to run the client
CMD [ "node", "daemon.js", "test" ]
