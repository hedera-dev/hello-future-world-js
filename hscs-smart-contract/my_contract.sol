// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

contract MyContract {
    mapping(address => string) public names;

    function introduce(string memory name) public {
        names[msg.sender] = name;
    }

    function greet() public view returns (string memory) {
        // NOTE: Store name in smart contract
        // Step (1) in the accompanying tutorial
        string memory name = names[msg.sender];
        return string.concat("Hello future! - ", name, " HFW-HSCS");
    }
}
