FROM node:12.10-alpine

USER node

# specify the working directory
WORKDIR /usr/src/bridge-server

# expose server and debug port
EXPOSE 8080 8080

# run application
CMD ["npm", "start"]
