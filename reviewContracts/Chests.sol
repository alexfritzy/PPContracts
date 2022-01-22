// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

interface IKeys {
    function ownerOf(uint256 tokenId) external view returns(address);
} 

interface IBooty {
    function burn(address _from, uint256 _amount) external;
    function mint(address _to, uint256 _amount) external;
} 

contract PPChests is ERC721, ERC721Enumerable, Ownable {
    using SafeMath for uint256;
    
    //Sale States
    bool public isKeyMintActive = false;
    bool public isAllowListActive = false;
    mapping(address => bool) public allowedAddresses;
    
    //Key tracking
    IKeys public Keys;
    mapping(uint256 => bool) public keyUsed;
    
    //Booty
    IBooty public Booty;
    mapping(uint256 => uint256) public chestBalance;
    mapping(uint256 => uint256) public lastUpdate;
    event ChestBalanceUpdate(uint256 chestId, uint256 balance);
    
    //Privates
    string private _baseURIextended;
    mapping(address => uint8) public allowList;
    
    //In tenths of a percent
    uint256 public constant DAILY_RATE = 14;
    
    constructor() ERC721("PixelPiracyChests", "PPCHESTS") {
    }
    //Key Minting
    function setKeys(address keysAddress) external onlyOwner {
        Keys = IKeys(keysAddress);
    }
    
    function setIsKeyMintActive(bool _isKeyMintActive) external onlyOwner {
        isKeyMintActive = _isKeyMintActive;
    }

    function mintWithKey(uint256[] calldata keyIds) external {
        uint256 ts = totalSupply();
        require(isKeyMintActive, "Key mint is not active");        
        
        for (uint256 i = 0; i < keyIds.length; i++) {
            require(Keys.ownerOf(keyIds[i]) == msg.sender, "Cannot redeem key you don't own");
            require(keyUsed[keyIds[i]] == false, "Key has been used");
            keyUsed[keyIds[i]] = true;
            _safeMint(msg.sender, ts + i);
        }
    }
    //

    //Allowed Minting
    function setIsAllowListActive(bool _isAllowListActive) external onlyOwner {
        isAllowListActive = _isAllowListActive;
    }

    function setAllowList(address[] calldata addresses, uint8 numAllowedToMint) external onlyOwner {
        for (uint256 i = 0; i < addresses.length; i++) {
            allowList[addresses[i]] = numAllowedToMint;
        }
    }

    function mintAllowList(uint8 numberOfTokens) external {
        uint256 ts = totalSupply();
        require(isAllowListActive, "Allow list is not active");
        require(numberOfTokens <= allowList[msg.sender], "Exceeded max available to purchase");

        allowList[msg.sender] -= numberOfTokens;
        for (uint256 i = 0; i < numberOfTokens; i++) {
            _safeMint(msg.sender, ts + i);
        }
    }

    //Controlled Minting
    function setAllowedAddresses(address _address, bool _access) public onlyOwner {
        allowedAddresses[_address] = _access;
    }

    function mintControlled(uint8 numberOfTokens, address _address) external {
        uint256 ts = totalSupply();
        require(allowedAddresses[msg.sender], "Address does not have permission to mint");

        for (uint256 i = 0; i < numberOfTokens; i++) {
            _safeMint(_address, ts + i);
        }
    }
    //
    
    //Booty
    function setBooty(address bootyAddress) external onlyOwner {
        Booty = IBooty(bootyAddress);
    }
    
    function deposit(uint256 chestId, uint256 amount) external {
        require(msg.sender == ownerOf(chestId), "Cannot interact with a chest you do not own");
        chestBalance[chestId] += getPendingInterest(chestId);
        chestBalance[chestId] += amount;
        Booty.burn(msg.sender, amount);
        lastUpdate[chestId] = block.timestamp;
        emit ChestBalanceUpdate(chestId, chestBalance[chestId]);
    }
    
    function withdraw(uint256 chestId, uint256 amount) external {
        require(msg.sender == ownerOf(chestId), "Cannot interact with a chest you do not own");
        require(chestBalance[chestId] >= amount, "Not enough Booty in chest");
        chestBalance[chestId] += getPendingInterest(chestId);
        chestBalance[chestId] -= amount;
        Booty.mint(msg.sender, amount);
        lastUpdate[chestId] = block.timestamp;
        emit ChestBalanceUpdate(chestId, chestBalance[chestId]);
    }
    
    function claimInterest(uint256 chestId) external {
        require(msg.sender == ownerOf(chestId), "Cannot interact with a chest you do not own");
        chestBalance[chestId] += getPendingInterest(chestId);
        lastUpdate[chestId] = block.timestamp;
        emit ChestBalanceUpdate(chestId, chestBalance[chestId]);
    }
    
    function getPendingInterest(uint256 chestId) public view returns(uint256) {
        uint256 interest = chestBalance[chestId] * DAILY_RATE * (block.timestamp - lastUpdate[chestId]) / 86400000;
        //Max 4 weeks of interest
        uint256 maxInterest = chestBalance[chestId] * 2 / 5;
        return interest < maxInterest ? interest : maxInterest;
    }
    //
    
    function walletOfOwner(address owner) external view returns(uint256[] memory) {
        uint256 tokenCount = balanceOf(owner);

        uint256[] memory tokensId = new uint256[](tokenCount);
        for(uint256 i; i < tokenCount; i++){
            tokensId[i] = tokenOfOwnerByIndex(owner, i);
        }
        return tokensId;
    }

    //Overrides
    function _beforeTokenTransfer(address from, address to, uint256 tokenId) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, ERC721Enumerable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function setBaseURI(string memory baseURI_) external onlyOwner() {
        _baseURIextended = baseURI_;
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return _baseURIextended;
    }
    //
}