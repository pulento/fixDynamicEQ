# Run: docker run -it --net=host -d pulento/fixDynamicEQ
# User --net=host since we need multicast
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install Git
RUN apk update && apk upgrade && \
    apk add --no-cache bash git openssh

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY manualREW* ./

# Copy App
COPY . .
RUN ls -la

# Start
RUN npm install
# If you are building your code for production
# RUN npm install --only=production

EXPOSE 3000
CMD [ "npm", "run", "start" ]
